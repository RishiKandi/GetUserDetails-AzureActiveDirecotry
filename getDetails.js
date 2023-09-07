const express = require('express');
const axios = require('axios');

const app = express();
const port = 3000; // Change this to the desired port number

const tenantId = '4779c6af-0689-4195-a99f-0e9c8b2c0652'; // Replace with your Azure AD tenant ID
const clientId = 'cdbf86e5-071c-497b-9161-2d892b37a1de'; // Replace with your Application ID (Client ID)
const clientSecret = 'Vs18Q~rp~hxy6NxZgLElvfr3ALSmVrY5caW5-cJR'; // Replace with your Application's Client Secret

// Middleware to parse incoming JSON data
app.use(express.json());

// API endpoint to fetch user details from Azure AD and include role information
app.post('/api/userDetails', async (req, res) => {
  const { username, password } = req.body;

  try {
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

    // Use the access token to make a request to get user roles
    const userRolesResponse = await axios.get(`https://graph.microsoft.com/v1.0/me/memberOf`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Check if the user is a member of the Admin role or the Employee role
    const userRoles = userRolesResponse.data.value;
    const isAdmin = userRoles.some(role => role.displayName === "Admin");
    const isEmployee = userRoles.some(role => role.displayName === "Employee");
    let userRole;

    if (isAdmin) {
      userRole = "admin";
    } else if (isEmployee) {
      userRole = "employee";
    } else {
      userRole = "guest"; // Or any default role if no specific role is found
    }

    // Use the userRole variable to return the user details along with the role
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
