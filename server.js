const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

let latestContext = null;
let latestParams = null;

// Main Canvas POST endpoint
app.get('/', (req, res) => {
    res.send(`Canvas app is running. Send a POST request with signed_request to interact.`);
})
app.post('/', (req, res) => {
    const sr = req.body.signed_request ? parseSignedRequest(req.body.signed_request) : null;

    if (sr) {
        console.log("Canvas signed request verified:", sr.context.user.fullName);
        latestContext = {
            instanceUrl: sr.client.instanceUrl,
            oauthToken: sr.client.oauthToken
        };
        latestParams = sr.context?.environment?.parameters || {};
        console.log("Parameters from Aura Canvas:", latestParams);
    } else {
        console.log("No signed request — running in local dev mode");
        latestParams = { recordId: null };
    }

    const userName = sr?.context?.user?.fullName || "Local Test User";
    const accountId = latestParams?.recordId || "";

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Create Contact</title>
            <style>
                body { font-family: Arial, sans-serif; background: #f8f9fa; padding: 20px; }
                .form-container {
                    max-width: 400px; background: #fff; padding: 20px;
                    border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
                h2 { margin-top: 0; font-size: 20px; text-align: center; }
                label { display: block; margin-top: 12px; font-weight: bold; }
                input {
                    width: 100%; padding: 8px; margin-top: 4px;
                    border-radius: 6px; border: 1px solid #ccc;
                }
                button {
                    margin-top: 16px; width: 100%; padding: 10px; border: none;
                    border-radius: 6px; background-color: #0070d2; color: white;
                    font-size: 16px; cursor: pointer;
                }
                button:hover { background-color: #005fb2; }
            </style>
        </head>
        <body>
            <div class="form-container">
                <h2>Create Contact</h2>
                <p>Welcome, ${userName}</p>
                <p>Creating contact for Account: <b>${accountId || 'No Account ID provided'}</b></p>

                <label for="firstName">First Name:</label>
                <input type="text" id="firstName" placeholder="Enter First Name" />

                <label for="lastName">Last Name:</label>
                <input type="text" id="lastName" placeholder="Enter Last Name" />

                <label for="phone">Phone:</label>
                <input type="text" id="phone" placeholder="Enter Phone Number" />

                <label for="email">Email:</label>
                <input type="text" id="email" placeholder="Enter Email" />

                <button onclick="createContact()">Create Contact</button>
            </div>

            <script>
                function createContact() {
                    const payload = {
                        FirstName: document.getElementById("firstName").value,
                        LastName: document.getElementById("lastName").value,
                        Phone: document.getElementById("phone").value,
                        Email: document.getElementById("email").value
                    };

                    fetch('/create-contact', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    })
                    .then(res => res.json())
                    .then(data => {
                        console.log("Salesforce Response:", data);
                        alert("Contact created: " + JSON.stringify(data));
                    })
                    .catch(err => {
                        console.error(err);
                        alert("Error creating contact: " + err);
                    });
                }
            </script>
        </body>
        </html>
    `);
});

// Endpoint to create Contact in Salesforce
app.post('/create-contact', async (req, res) => {
    if (!latestContext?.instanceUrl || !latestContext?.oauthToken) {
        return res.status(400).json({ error: 'No Salesforce session available (not in Canvas?)' });
    }

    const accountId = latestParams?.recordId;
    if (!accountId) {
        return res.status(400).json({ error: 'No AccountId provided in Canvas parameters' });
    }

    const contactPayload = {
        ...req.body,
        AccountId: accountId
    };

    try {
        const sfRes = await axios.post(
            `${latestContext.instanceUrl}/services/data/v61.0/sobjects/Contact/`,
            contactPayload,
            {
                headers: {
                    Authorization: `OAuth ${latestContext.oauthToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        res.json(sfRes.data);
    } catch (err) {
        console.error("Salesforce API error:", err.response?.data || err.message);
        res.status(500).json(err.response?.data || { error: err.message });
    }
});

// Helper: Parse Canvas signed request
function parseSignedRequest(signedRequest) {
    const [sig, payload] = signedRequest.split('.');
    return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
}

app.listen(3000, () => {
    console.log('Canvas app running at http://localhost:3000');
});
