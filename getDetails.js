const express = require('express');
const axios = require('axios');

const app = express();
const port = 3000; // Change this to the desired port number

const tenantId = ''; // Replace with your Azure AD tenant ID
const clientId = ''; // Replace with your Application ID (Client ID)
const clientSecret = ''; // Replace with your Application's Client Secret

// Middleware to parse incoming JSON data
app.use(express.json());

// Function to check if the app role is assigned to the 'Employee' group for a specific user
async function isAppRoleAssignedToEmployee(username) {
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

    // Check if the app role with ID '8e06e15d-ef0b-4c4d-8307-a9b2aa694395' is assigned to the 'Employee' group
    const appRoleAssignments = appRoleAssignmentsResponse.data.value;
    const isAssignedToEmployee = appRoleAssignments.some(roleAssignment => {
      return (
        (roleAssignment.appRoleId === 'app registration group id' && roleAssignment.principalType === 'Group' && roleAssignment.principalDisplayName === 'Employee') ||
        (roleAssignment.appRoleId === 'app registration group id' && roleAssignment.principalType === 'Group' && roleAssignment.principalDisplayName === 'Admin')
      );
    });

    return isAssignedToEmployee;
  } catch (error) {
    console.error(error);
    return false;
  }
}

// Function to authenticate user credentials and determine user role from Azure AD
async function authenticateUser(username, password) {
  try {
    // Check if the app role is assigned to the 'Employee' or 'Admin' group for the user
    const isAssignedToEmployee = await isAppRoleAssignedToEmployee(username);

    if (isAssignedToEmployee) {
      return "Employee";
    }

    const authResponse = await axios.post(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      `grant_type=password&client_id=${clientId}&scope=https://graph.microsoft.com/.default&client_secret=${clientSecret}&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      }
    );

    const accessToken = authResponse.data.access_token;

    // Use the access token to make a request to get user roles
    const userRolesResponse = await axios.get(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(username)}/appRoleAssignments`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Check if the user is a member of the Admin role
    const userRoles = userRolesResponse.data.value;
    const filteredRoles = userRoles.filter(role => role.displayName !== null);
    console.log("User roles:", filteredRoles);
    const isAdmin = filteredRoles.some(role => role.displayName === "Admin");

    if (isAdmin) {
      return "Admin";
    } else {
      return "Guest"; // Or any default role if no specific role is found
    }
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
