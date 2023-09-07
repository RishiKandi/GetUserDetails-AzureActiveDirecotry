const express = require('express');
const axios = require('axios');

const app = express();
const port = 3000; // Change this to the desired port number

const tenantId = '4779c6af-0689-4195-a99f-0e9c8b2c0652'; // Replace with your Azure AD tenant ID
const clientId = 'cdbf86e5-071c-497b-9161-2d892b37a1de'; // Replace with your Application ID (Client ID)
const clientSecret = 'Vs18Q~rp~hxy6NxZgLElvfr3ALSmVrY5caW5-cJR'; // Replace with your Application's Client Secret

// Middleware to parse incoming JSON data
app.use(express.json());

// Function to check if the app role is assigned to the 'Employee' or 'Admin' group for a specific user
async function isAppRoleAssigned(username, appRoleId, groupName) {
  try {
    // Get the access token using client credentials
    const authResponse = await axios.post(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}&scope=https://graph.microsoft.com/.default`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    // Extract the access token from the response
    const accessToken = authResponse.data.access_token;

    // Use the access token to make a request to get app role assignments for the user
    const appRoleAssignmentsResponse = await axios.get(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(username)}/appRoleAssignments`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Check if the app role with the specified ID is assigned to the specified group for the user
    const appRoleAssignments = appRoleAssignmentsResponse.data.value;
    return appRoleAssignments.some(roleAssignment => {
      return (
        roleAssignment.appRoleId === appRoleId &&
        roleAssignment.principalType === 'Group' &&
        roleAssignment.principalDisplayName === groupName
      );
    });
  } catch (error) {
    console.error(error);
    return false;
  }
}

// Function to authenticate user credentials and determine user role from Azure AD
async function authenticateUser(username, password) {
  try {
    // Check if the app role is assigned to the 'Employee' group for the user
    const isEmployee = await isAppRoleAssigned(username, '8e06e15d-ef0b-4c4d-8307-a9b2aa694395', 'Employee');
    if (isEmployee) {
      return "Employee";
    }

    // Check if the app role is assigned to the 'Admin' group for the user
    var isAdmin = await isAppRoleAssigned(username, '48978d69-12e1-4a8c-866e-99480c3d0a00', 'Admin');
    if (isAdmin) {
      return "Admin";
    }

    // If the user is not explicitly assigned any role, consider them as a "Guest"
    return "Guest";
  } catch (error) {
    console.error(error);
    return null;
  }
}

// API endpoint to fetch user details from Azure AD and include role information
app.post('/api/userDetails', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Authenticate user credentials and fetch the role
    const userRole = await authenticateUser(username, password);
    if (!userRole) {
      return res.status(401).json({ error: 'Invalid credentials or user not found' });
    } 

    // Get the access token using client credentials
    const authResponse = await axios.post(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      `grant_type=password&client_id=${clientId}&scope=https://graph.microsoft.com/.default&client_secret=${clientSecret}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    // Extract the access token from the response
    const accessToken = authResponse.data.access_token;

    // Use the access token to make a request to get user details
    const userDetailsResponse = await axios.get('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Return the user details along with the role
    const userDetails = userDetailsResponse.data;
    userDetails.role = userRole; // Adding the role to the response object

    res.json(userDetails);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user details from Azure AD' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`API server is running on http://localhost:${port}`);
});
