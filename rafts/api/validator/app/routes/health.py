# ***********************************************************************
# ******************  CANADIAN ASTRONOMY DATA CENTRE  ******************
# *************  CENTRE CANADIEN DE DONNÉES ASTRONOMIQUES  *************
#
#  (c) 2026.                            (c) 2026.
#  Government of Canada                 Gouvernement du Canada
#  National Research Council            Conseil national de recherches
#  Ottawa, Canada, K1A 0R6              Ottawa, Canada, K1A 0R6
#  All rights reserved                  Tous droits réservés
#
#  NRC disclaims any warranties,        Le CNRC dénie toute garantie
#  expressed, implied, or               énoncée, implicite ou légale,
#  statutory, of any kind with          de quelque nature que ce
#  respect to the software,             soit, concernant le logiciel,
#  including without limitation         y compris sans restriction
#  any warranty of merchantability      toute garantie de valeur
#  or fitness for a particular          marchande ou de pertinence
#  purpose. NRC shall not be            pour un usage particulier.
#  liable in any event for any          Le CNRC ne pourra en aucun cas
#  damages, whether direct or           être tenu responsable de tout
#  indirect, special or general,        dommage, direct ou indirect,
#  consequential or incidental,         particulier ou général,
#  arising from the use of the          accessoire ou fortuit, résultant
#  software.  Neither the name          de l'utilisation du logiciel. Ni
#  of the National Research             le nom du Conseil National de
#  Council of Canada nor the            Recherches du Canada ni les noms
#  names of its contributors may        de ses  participants ne peuvent
#  be used to endorse or promote        être utilisés pour approuver ou
#  products derived from this           promouvoir les produits dérivés
#  software without specific prior      de ce logiciel sans autorisation
#  written permission.                  préalable et particulière
#                                       par écrit.
#
#  This file is part of the             Ce fichier fait partie du projet
#  OpenCADC project.                    OpenCADC.
#
#  OpenCADC is free software:           OpenCADC est un logiciel libre ;
#  you can redistribute it and/or       vous pouvez le redistribuer ou le
#  modify it under the terms of         modifier suivant les termes de
#  the GNU Affero General Public        la "GNU Affero General Public
#  License as published by the          License" telle que publiée
#  Free Software Foundation,            par la Free Software Foundation
#  either version 3 of the              : soit la version 3 de cette
#  License, or (at your option)         licence, soit (à votre gré)
#  any later version.                   toute version ultérieure.
#
#  OpenCADC is distributed in the       OpenCADC est distribué
#  hope that it will be useful,         dans l'espoir qu'il vous
#  but WITHOUT ANY WARRANTY;            sera utile, mais SANS AUCUNE
#  without even the implied             GARANTIE : sans même la garantie
#  warranty of MERCHANTABILITY          implicite de COMMERCIALISABILITÉ
#  or FITNESS FOR A PARTICULAR          ni d'ADÉQUATION À UN OBJECTIF
#  PURPOSE.  See the GNU Affero         PARTICULIER. Consultez la Licence
#  General Public License for           Générale Publique GNU Affero
#  more details.                        pour plus de détails.
#
#  You should have received             Vous devriez avoir reçu une
#  a copy of the GNU Affero             copie de la Licence Générale
#  General Public License along         Publique GNU Affero avec
#  with OpenCADC.  If not, see          OpenCADC ; si ce n'est
#  <http://www.gnu.org/licenses/>.      pas le cas, consultez :
#                                       <http://www.gnu.org/licenses/>.
#
# ***********************************************************************

from fastapi import APIRouter
from fastapi.responses import JSONResponse
from app.config import (
    ADES_DIR,
    ADES_PYTHON_BIN,
    ADES_XML_DIR,
    ADES_XSD_DIR,
    ADES_XSLT_DIR,
    logger,
)
from app.utils.paths import get_converter_path

router = APIRouter()


@router.get("/health-check")
async def health_check():
    """
    Health check endpoint to verify the API and ADES tools are working.
    """
    try:
        # Check if key files and directories exist
        status = {
            "ades_dir_exists": ADES_DIR.exists(),
            "python_bin_exists": ADES_PYTHON_BIN.exists(),
            "xml_dir_exists": ADES_XML_DIR.exists(),
            "xsd_dir_exists": ADES_XSD_DIR.exists(),
            "xslt_dir_exists": ADES_XSLT_DIR.exists(),
        }

        # Check for validator scripts
        validator_scripts = {
            "valall.py": ADES_PYTHON_BIN / "valall.py",
            "valsubmit.py": ADES_PYTHON_BIN / "valsubmit.py",
            "valgeneral.py": ADES_PYTHON_BIN / "valgeneral.py",
        }

        for script_name, script_path in validator_scripts.items():
            status[f"{script_name}_exists"] = script_path.exists()

        # Check for converter scripts
        status["psvtoxml_exists"] = get_converter_path("psvtoxml") is not None
        status["mpc80coltoxml_exists"] = get_converter_path("mpc80coltoxml") is not None

        # Check for XSD files
        xsd_files = {
            "submit.xsd": ADES_XSD_DIR / "submit.xsd",
            "general.xsd": ADES_XSD_DIR / "general.xsd",
        }

        for xsd_name, xsd_path in xsd_files.items():
            status[f"{xsd_name}_exists"] = xsd_path.exists()

        # Check for adesmaster.xml
        adesmaster = ADES_XML_DIR / "adesmaster.xml"
        status["adesmaster_xml_exists"] = adesmaster.exists()

        # Check LXML availability
        import importlib.util

        status["lxml_available"] = importlib.util.find_spec("lxml.etree") is not None

        # Feature availability
        features = {
            "xml_validation": all(
                status.get(f"{script}_exists", False)
                for script in ["valall.py", "valsubmit.py", "valgeneral.py"]
            ),
            "psv_validation": status["psvtoxml_exists"],
            "mpc_validation": status["mpc80coltoxml_exists"],
        }

        status["features"] = features

        # Overall status - critical components for all validation methods
        critical_components = [
            status["ades_dir_exists"],
            status["xsd_dir_exists"],
            status["lxml_available"],
            any(status.get(f"{xsd}_exists", False) for xsd in xsd_files),
        ]

        # Service is ready if core components are available, even if some features are missing
        service_ready = all(critical_components)

        status["status"] = "healthy" if service_ready else "degraded"

        if service_ready:
            available_features = [
                name for name, available in features.items() if available
            ]
            missing_features = [
                name for name, available in features.items() if not available
            ]

            if all(features.values()):
                status["message"] = "Service is fully operational with all features"
            else:
                status["message"] = (
                    f"Service is operational with limited features. Available: {', '.join(available_features)}. Missing: {', '.join(missing_features)}"
                )
        else:
            status["message"] = "Some critical components are missing"

        # Set appropriate HTTP status code
        http_status = 200 if service_ready else 503

        return JSONResponse(status_code=http_status, content=status)
    except Exception as e:
        logger.error(f"Health check error: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "status": "error",
                "message": f"Error during health check: {str(e)}",
            },
        )


@router.get("/")
async def home():
    """
    API home page with information about available endpoints.
    """
    # Check which features are available
    psv_converter_exists = get_converter_path("psvtoxml") is not None
    mpc_converter_exists = get_converter_path("mpc80coltoxml") is not None

    # Create the response
    endpoints = {
        "/validate-xml": {"description": "Validate ADES XML files", "available": True},
        "/validate-psv": {
            "description": "Convert PSV to XML and validate",
            "available": psv_converter_exists,
        },
        "/validate-mpc": {
            "description": "Convert MPC 80-column format to XML and validate",
            "available": mpc_converter_exists,
        },
        "/health-check": {
            "description": "Check API and ADES tools health",
            "available": True,
        },
    }

    return {
        "title": "RAFT ADES Validator API",
        "description": "API for validating ADES files in various formats",
        "version": "1.0.0",
        "endpoints": endpoints,
    }
