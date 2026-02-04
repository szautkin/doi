/*
 ************************************************************************
 *******************  CANADIAN ASTRONOMY DATA CENTRE  *******************
 **************  CENTRE CANADIEN DE DONNÉES ASTRONOMIQUES  **************
 *
 *  (c) 2026.                            (c) 2026.
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

'use client'

import { Chip, Tooltip } from '@mui/material'

type StatusType =
  | 'minted'
  | 'in progress'
  | 'review ready'
  | 'in review'
  | 'approved'
  | 'rejected'
  | string

interface StatusBadgeProps {
  status: StatusType
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusInfo = (status: StatusType) => {
    switch (status?.toLowerCase()) {
      // Published/Minted
      case 'minted':
      case 'published':
        return {
          bg: 'success.main',
          color: 'white',
          label: 'Published',
          tooltip: 'This RAFT has been published with a DOI',
        }

      // Approved (awaiting minting)
      case 'approved':
        return {
          bg: 'info.main',
          color: 'white',
          label: 'Approved',
          tooltip: 'This RAFT has been approved and is ready for publishing',
        }

      // Review Ready (submitted, waiting for reviewer to claim)
      case 'review ready':
        return {
          bg: 'warning.light',
          color: 'black',
          label: 'Review Ready',
          tooltip: 'This RAFT has been submitted and is waiting for a reviewer',
        }

      // In Review (reviewer has claimed)
      case 'in review':
        return {
          bg: 'warning.main',
          color: 'black',
          label: 'In Review',
          tooltip: 'This RAFT is being reviewed',
        }

      // Rejected
      case 'rejected':
        return {
          bg: 'error.main',
          color: 'white',
          label: 'Rejected',
          tooltip: 'This RAFT has been rejected',
        }

      // Draft/In Progress
      case 'in progress':
      default:
        return {
          bg: 'grey.400',
          color: 'black',
          label: 'Draft',
          tooltip: 'This RAFT is a draft',
        }
    }
  }

  const { bg, color, label, tooltip } = getStatusInfo(status)

  return (
    <Tooltip title={tooltip} arrow placement="top">
      <Chip
        label={label}
        size="small"
        sx={{
          backgroundColor: bg,
          color: color,
          fontWeight: 'medium',
        }}
      />
    </Tooltip>
  )
}
