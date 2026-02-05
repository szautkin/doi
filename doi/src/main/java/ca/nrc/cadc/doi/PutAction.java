/*
************************************************************************
*******************  CANADIAN ASTRONOMY DATA CENTRE  *******************
**************  CENTRE CANADIEN DE DONNÉES ASTRONOMIQUES  **************
*
*  (c) 2024.                            (c) 2024.
*  Government of Canada                 Gouvernement du Canada
*  National Research Council            Conseil national de recherches
*  Ottawa, Canada, K1A 0R6              Ottawa, Canada, K1A 0R6
*  All rights reserved                  Tous droits réservés
*
*  NRC disclaims any warranties,        Le CNRC dénie toute garantie
*  expressed, implied, or               énoncée, implicite ou légale,
*  statutory, of any kind with          de quelque nature que ce
*  respect to the software,             soit, concernant le logiciel,
*  including without limitation         y compris sans restriction
*  any warranty of merchantability      toute garantie de valeur
*  or fitness for a particular          marchande ou de pertinence
*  purpose. NRC shall not be            pour un usage particulier.
*  liable in any event for any          Le CNRC ne pourra en aucun cas
*  damages, whether direct or           être tenu responsable de tout
*  indirect, special or general,        dommage, direct ou indirect,
*  consequential or incidental,         particulier ou général,
*  arising from the use of the          accessoire ou fortuit, résultant
*  software.  Neither the name          de l'utilisation du logiciel. Ni
*  of the National Research             le nom du Conseil National de
*  Council of Canada nor the            Recherches du Canada ni les noms
*  names of its contributors may        de ses  participants ne peuvent
*  be used to endorse or promote        être utilisés pour approuver ou
*  products derived from this           promouvoir les produits dérivés
*  software without specific prior      de ce logiciel sans autorisation
*  written permission.                  préalable et particulière
*                                       par écrit.
*
*  This file is part of the             Ce fichier fait partie du projet
*  OpenCADC project.                    OpenCADC.
*
*  OpenCADC is free software:           OpenCADC est un logiciel libre ;
*  you can redistribute it and/or       vous pouvez le redistribuer ou le
*  modify it under the terms of         modifier suivant les termes de
*  the GNU Affero General Public        la "GNU Affero General Public
*  License as published by the          License" telle que publiée
*  Free Software Foundation,            par la Free Software Foundation
*  either version 3 of the              : soit la version 3 de cette
*  License, or (at your option)         licence, soit (à votre gré)
*  any later version.                   toute version ultérieure.
*
*  OpenCADC is distributed in the       OpenCADC est distribué
*  hope that it will be useful,         dans l'espoir qu'il vous
*  but WITHOUT ANY WARRANTY;            sera utile, mais SANS AUCUNE
*  without even the implied             GARANTIE : sans même la garantie
*  warranty of MERCHANTABILITY          implicite de COMMERCIALISABILITÉ
*  or FITNESS FOR A PARTICULAR          ni d'ADÉQUATION À UN OBJECTIF
*  PURPOSE.  See the GNU Affero         PARTICULIER. Consultez la Licence
*  General Public License for           Générale Publique GNU Affero
*  more details.                        pour plus de détails.
*
*  You should have received             Vous devriez avoir reçu une
*  a copy of the GNU Affero             copie de la Licence Générale
*  General Public License along         Publique GNU Affero avec
*  with OpenCADC.  If not, see          OpenCADC ; si ce n'est
*  <http://www.gnu.org/licenses/>.      pas le cas, consultez :
*                                       <http://www.gnu.org/licenses/>.
*
************************************************************************
*/

package ca.nrc.cadc.doi;

import ca.nrc.cadc.ac.Group;
import ca.nrc.cadc.ac.GroupAlreadyExistsException;
import ca.nrc.cadc.ac.User;
import ca.nrc.cadc.ac.UserNotFoundException;
import ca.nrc.cadc.ac.client.GMSClient;
import ca.nrc.cadc.doi.datacite.Date;
import ca.nrc.cadc.doi.datacite.DateType;
import ca.nrc.cadc.doi.datacite.Identifier;
import ca.nrc.cadc.doi.datacite.Resource;
import ca.nrc.cadc.doi.datacite.Title;
import ca.nrc.cadc.doi.status.Status;
import ca.nrc.cadc.util.StringUtil;

import java.lang.reflect.Field;
import java.net.URI;
import java.security.PrivilegedExceptionAction;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import javax.security.auth.Subject;

import org.apache.log4j.Logger;
import org.json.JSONObject;
import org.opencadc.gms.GroupURI;
import org.opencadc.vospace.ContainerNode;
import org.opencadc.vospace.DataNode;
import org.opencadc.vospace.Node;
import org.opencadc.vospace.NodeProperty;
import org.opencadc.vospace.VOSURI;

/**
 * PutAction handles PUT requests for creating new DOIs.
 * PUT /instances/ - Create a new DOI
 */
public class PutAction extends DoiAction {
    private static final Logger log = Logger.getLogger(PutAction.class);

    public PutAction() {
        super();
    }

    @Override
    public void doAction() throws Exception {
        super.init();
        authorize();

        // PUT to /instances/ creates a new DOI
        if (doiSuffix != null) {
            throw new IllegalArgumentException("PUT request should not include DOI suffix. Use POST to update existing DOI.");
        }

        // Do DOI creation work as doi admin
        Subject.doAs(getAdminSubject(), (PrivilegedExceptionAction<Object>) () -> {
            createDOI();
            return null;
        });
    }

    /**
     * Create a new DOI.
     */
    private void createDOI() throws Exception {
        Resource doiMetaData = (Resource) syncInput.getContent(DoiInlineContentHandler.META_DATA_KEY);
        if (doiMetaData == null) {
            throw new IllegalArgumentException("No content");
        }
        // doiNodeData can be null
        JSONObject doiNodeData = (JSONObject) syncInput.getContent(DoiInlineContentHandler.NODE_DATA_KEY);
        Map<URI, String> nodePropertyMap = getNodeProperties(doiNodeData);

        boolean randomTestID = Boolean.parseBoolean(config.getFirstPropertyValue(DoiInitAction.RANDOM_TEST_ID_KEY));
        String doiIdentifierPrefix = DoiInitAction.getDoiIdentifierPrefix(config);
        String nextDoiSuffix;

        if (randomTestID) {
            nextDoiSuffix = doiIdentifierPrefix + getRandomDOISuffix();
            log.warn("Random DOI suffix: " + nextDoiSuffix);
        } else {
            // Determine next DOI ID
            nextDoiSuffix = doiIdentifierPrefix + getNextDOISuffix(vospaceDoiClient.getDoiBaseVOSURI());
            log.debug("Next DOI suffix: " + nextDoiSuffix);
        }

        // Update the resource with the DOI ID
        assignIdentifier(doiMetaData.getIdentifier(), accountPrefix + "/" + nextDoiSuffix);

        // Add a Created date to the Resource object
        LocalDate localDate = LocalDate.now();
        String createdDate = localDate.format(DateTimeFormatter.ISO_LOCAL_DATE);
        Date doiDate = new Date(createdDate, DateType.CREATED);
        doiDate.dateInformation = "The date the DOI was created";
        doiMetaData.dates = new java.util.ArrayList<>();
        doiMetaData.dates.add(doiDate);

        // Create the group that is able to administer the DOI process
        String groupName = doiGroupPrefix + nextDoiSuffix;
        GroupURI guri = createDoiGroup(groupName);
        log.debug("Created DOI group: " + guri);

        // Create the VOSpace area for DOI work
        ContainerNode doiFolder = createDOIDirectory(guri, nextDoiSuffix, getTitle(doiMetaData).getValue(), nodePropertyMap);
        log.debug("Created DOI folder: " + doiFolder);

        // create VOSpace data node to house XML doc using doi filename and upload the document
        String docName = getDoiFilename(nextDoiSuffix);
        DataNode doiDocNode = new DataNode(docName);
        VOSURI doiDocVOSURI = getVOSURI(nextDoiSuffix + "/" + docName);
        vospaceDoiClient.getVOSpaceClient().createNode(doiDocVOSURI, doiDocNode);
        uploadDOIDocument(doiMetaData, doiDocVOSURI);
        log.debug("Created DOI metadata document: " + doiDocVOSURI);

        // Create the DOI data folder
        VOSURI dataVOSURI = getVOSURI(nextDoiSuffix + "/data");
        ContainerNode newDataFolder = new ContainerNode("data");
        setPermissions(newDataFolder, guri);
        vospaceDoiClient.getVOSpaceClient().createNode(dataVOSURI, newDataFolder);
        log.debug("Created DOI data folder: " + dataVOSURI);

        // Done, send redirect to GET for the XML file just made
        String redirectUrl = syncInput.getRequestURI() + "/" + nextDoiSuffix;
        syncOutput.setHeader("Location", redirectUrl);
        syncOutput.setCode(303);
    }

    private String getRandomDOISuffix() {
        String allowed = "abcdefghjkmnpqrstuvwxyz1234567890";
        StringBuilder sb = new StringBuilder();
        Random random = new Random();
        while (sb.length() < 11) {
            if (sb.length() == 5) {
                sb.append("-");
            } else {
                int index = (int) (random.nextFloat() * allowed.length());
                sb.append(allowed.charAt(index));
            }
        }
        sb.append(".test");
        return sb.toString();
    }

    /**
     * child nodes of baseNode should have name structure YY.XXXX
     * go through list of child nodes
     * extract XXXX
     * track largest
     * add 1
     * reconstruct YY.XXXX structure and return
     */
    private String getNextDOISuffix(VOSURI baseDoiURI) throws Exception {
        ContainerNode baseNode = (ContainerNode) vospaceDoiClient.getVOSpaceClient().getNode(baseDoiURI.getPath());
        java.text.DateFormat df = new java.text.SimpleDateFormat("yy");
        String currentYear = df.format(java.util.Calendar.getInstance().getTime());

        int maxDoi = 0;
        if (!baseNode.getNodes().isEmpty()) {
            for (Node childNode : baseNode.getNodes()) {
                String[] nameParts = childNode.getName().split("\\.");
                if (nameParts[0].equals(currentYear)) {
                    try {
                        int curDoiNum = Integer.parseInt(nameParts[1]);
                        if (curDoiNum > maxDoi) {
                            maxDoi = curDoiNum;
                        }
                    } catch (NumberFormatException e) {
                        // not a DOI node, skip...
                    }
                }
            }
        }

        maxDoi++;
        String formattedDOI = String.format("%04d", maxDoi);
        return currentYear + "." + formattedDOI;
    }

    public static void assignIdentifier(Object ce, String identifier) {
        try {
            Field f = Identifier.class.getDeclaredField("value");
            f.setAccessible(true);
            f.set(ce, identifier);
        } catch (NoSuchFieldException fex) {
            throw new RuntimeException("Identifier class is missing the value field", fex);
        } catch (IllegalAccessException bug) {
            throw new RuntimeException("No access to Identifier value field", bug);
        }
    }

    private GroupURI createDoiGroup(String groupName) throws Exception {
        GroupURI guri = createGroupURI(groupName);
        log.debug("creating group: " + guri);

        Group doiRWGroup = new Group(guri);
        User member = new User();
        member.getIdentities().addAll(callingSubject.getPrincipals());
        doiRWGroup.getUserMembers().add(member);
        doiRWGroup.getUserAdmins().add(member);

        try {
            GMSClient gmsClient = getGMSClient();
            gmsClient.createGroup(doiRWGroup);
        } catch (GroupAlreadyExistsException | UserNotFoundException gaeex) {
            throw new RuntimeException(gaeex);
        }
        log.debug("doi group created: " + guri);
        return guri;
    }

    private ContainerNode createDOIDirectory(GroupURI guri, String folderName, String title,
                                             Map<URI, String> nodePropertyMap) throws Exception {
        List<NodeProperty> properties = new java.util.ArrayList<>();
        properties.add(new NodeProperty(DOI.VOSPACE_DOI_STATUS_PROPERTY, Status.DRAFT.getValue()));
        properties.add(new NodeProperty(DOI.VOSPACE_DOI_TITLE_PROPERTY, title));
        properties.add(new NodeProperty(DOI.VOSPACE_DOI_REQUESTER_PROPERTY, String.valueOf(callersNumericId)));

        // add any additional properties from the nodePropertyMap
        String journalRef = nodePropertyMap.get(DOI.VOSPACE_DOI_JOURNAL_PROPERTY);
        if (journalRef != null) {
            properties.add(new NodeProperty(DOI.VOSPACE_DOI_JOURNAL_PROPERTY, journalRef));
        }

        VOSURI newVOSURI = getVOSURI(folderName);
        ContainerNode newFolder = new ContainerNode(folderName);

        setPermissions(newFolder, guri);

        newFolder.getProperties().addAll(properties);
        vospaceDoiClient.getVOSpaceClient().createNode(newVOSURI, newFolder);
        return newFolder;
    }

    private Title getTitle(Resource resource) {
        List<Title> titles = resource.getTitles();
        for (Title t : titles) {
            if (StringUtil.hasText(t.getValue())) {
                return t;
            }
        }
        throw new IllegalArgumentException("DOI metadata must include a title with text content");
    }

    private void setPermissions(Node node, GroupURI doiGroup) {
        node.isPublic = false;
        node.getReadOnlyGroup().add(doiGroup);
        node.getReadWriteGroup().add(doiGroup);
        if (publisherGroupURI != null) {
            node.getReadOnlyGroup().add(publisherGroupURI);
            node.getReadWriteGroup().add(publisherGroupURI);
        }
    }

    private Map<URI, String> getNodeProperties(JSONObject nodeData) {
        Map<URI, String> propertyMap = new HashMap<>();
        if (nodeData != null) {
            for (String key : nodeData.keySet()) {
                Object keyValue = nodeData.get(key);
                String value = keyValue == null ? null : keyValue.toString();

                switch (key) {
                    case DOI.JOURNALREF_NODE_PARAMETER:
                        propertyMap.put(DOI.VOSPACE_DOI_JOURNAL_PROPERTY, value);
                        break;
                    default:
                        throw new IllegalArgumentException("Unknown property for create: " + key);
                }
            }
        }
        return propertyMap;
    }
}
