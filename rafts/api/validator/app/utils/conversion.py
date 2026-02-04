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

import os
import asyncio
import sys
from lxml import etree
from app.config import ADES_PYTHON_BIN, logger
from app.utils.paths import get_converter_path


async def convert_psv_to_xml(psv_file_path, xml_output_path):
    """
    Convert a PSV file to XML format using the ADES converter.

    Args:
        psv_file_path: Path to the PSV file
        xml_output_path: Path to save the resulting XML file

    Returns:
        Tuple of (success, message)
    """
    try:
        # Look for the psvtoxml script
        converter = get_converter_path("psvtoxml")

        if converter is None:
            return False, "PSV to XML converter script not found"

        logger.info(f"Converting PSV to XML: {psv_file_path} -> {xml_output_path}")

        # Set up environment variables
        env = os.environ.copy()
        env["PYTHONPATH"] = f"{str(ADES_PYTHON_BIN)}:{env.get('PYTHONPATH', '')}"

        # Run the conversion script asynchronously
        process = await asyncio.create_subprocess_exec(
            sys.executable,
            str(converter),
            str(psv_file_path),
            str(xml_output_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        stdout_bytes, stderr_bytes = await process.communicate()
        result_stdout = stdout_bytes.decode()
        result_stderr = stderr_bytes.decode()
        result_returncode = process.returncode

        # Check if the conversion was successful and the output parses
        if (
            result_returncode == 0
            and os.path.exists(xml_output_path)
            and not (result_stdout.strip() or result_stderr.strip())
        ):
            try:
                etree.parse(xml_output_path)
            except Exception as e:  # includes XMLSyntaxError
                if os.path.exists(xml_output_path):
                    os.unlink(xml_output_path)
                return False, f"PSV to XML conversion produced invalid XML: {str(e)}"
            return True, "PSV to XML conversion successful"
        else:
            error_message = result_stdout + "\n" + result_stderr
            return False, f"PSV to XML conversion failed: {error_message}"

    except Exception as e:
        logger.error(f"PSV to XML conversion error: {str(e)}")
        return False, f"Error during PSV to XML conversion: {str(e)}"


async def convert_mpc_to_xml(mpc_file_path, xml_output_path):
    """
    Convert an MPC 80-column format file to XML using the ADES converter.

    Args:
        mpc_file_path: Path to the MPC 80-column file
        xml_output_path: Path to save the resulting XML file

    Returns:
        Tuple of (success, message)
    """
    try:
        # Look for the mpc80coltoxml script
        converter = get_converter_path("mpc80coltoxml")

        if converter is None:
            return False, "MPC 80-column to XML converter script not found"

        logger.info(
            f"Converting MPC 80-column to XML: {mpc_file_path} -> {xml_output_path}"
        )

        # Set up environment variables
        env = os.environ.copy()
        env["PYTHONPATH"] = f"{str(ADES_PYTHON_BIN)}:{env.get('PYTHONPATH', '')}"

        # Run the conversion script asynchronously
        process = await asyncio.create_subprocess_exec(
            sys.executable,
            str(converter),
            str(mpc_file_path),
            str(xml_output_path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
        )
        stdout_bytes, stderr_bytes = await process.communicate()
        result_stdout = stdout_bytes.decode()
        result_stderr = stderr_bytes.decode()
        result_returncode = process.returncode

        # Check if the conversion was successful and the output parses
        if (
            result_returncode == 0
            and os.path.exists(xml_output_path)
            and not (result_stdout.strip() or result_stderr.strip())
        ):
            try:
                etree.parse(xml_output_path)
            except Exception as e:  # includes XMLSyntaxError
                if os.path.exists(xml_output_path):
                    os.unlink(xml_output_path)
                return False, (
                    f"MPC 80-column to XML conversion produced invalid XML: {str(e)}"
                )
            return True, "MPC 80-column to XML conversion successful"
        else:
            error_message = result_stdout + "\n" + result_stderr
            return False, f"MPC 80-column to XML conversion failed: {error_message}"

    except Exception as e:
        logger.error(f"MPC 80-column to XML conversion error: {str(e)}")
        return False, f"Error during MPC 80-column to XML conversion: {str(e)}"
