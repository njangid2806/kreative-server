const express = require("express");
const configJson = require("./config.json");
require("dotenv").config();
const axios = require("axios");
const {
  auth,
  claimEquals,
  requiredScopes,
} = require("express-oauth2-jwt-bearer");

const PORT = process.env.PORT || 3001;
const client_id = "xyyYy6J67SQ9BLhCxSt30YsBURb6r85N";
const client_secret =
  "--redacted--";
const audience = "https://nrj-auth-tenant.us.auth0.com/api/v2/";
const token_audience = "https://kreative-order/";
const tokenApiUrl = "https://nrj-auth-tenant.us.auth0.com/oauth/token";
const issuerBaseURL = "https://nrj-auth-tenant.us.auth0.com/";

const app = express();

const checkJwt = auth({
  audience: token_audience,
  issuerBaseURL,
});

const cors = require("cors");
const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));

app.use(
  express.urlencoded({
    extended: true,
  })
);

app.use(express.json());

let access_token;

const getToken = async () => {
  const config = {
    url: tokenApiUrl,
    method: "POST",
    headers: { "content-type": "application/json" },
    data:
      '{"client_id":"' +
      client_id +
      '","client_secret":"' +
      client_secret +
      '","audience":"' +
      audience +
      '","grant_type":"client_credentials"}',
  };

  let response = await axios(config);

  //console.log(response.data);

  if (response.status !== 200) {
    console.log("[-] Get Token : status code -->", response.status);
    return callback(new Error(response.data));
  } else {
    //console.log('[-] Get Token: status code -->', response.data);
    var tokens = response.data;
    //console.log('[-] Tokens  -->', tokens);

    for (var key in tokens) {
      if (tokens.hasOwnProperty(key)) {
        if (key === "access_token") {
          //console.log(key + " -> " + tokens[key]);
          access_token = tokens[key];
          console.log("access_token: ", access_token);
        }
      }
    }
  }
};
getToken();

const updateUserMetadata = async (userEmail, updatedUserMetadata) => {
  const getUserApiUrl = issuerBaseURL + configJson.USER_URL + userEmail;
  const config = {
    url: getUserApiUrl,
    method: "GET",
    headers: {
      Authorization: "Bearer " + access_token,
    },
  };

  let response = await axios(config);
  if (response.status !== 200) {
    console.log(
      "[-] Get User (",
      userEmail,
      "): token retrieved ,status code -->",
      response.status
    );
    return new Error(data);
  } else {
    const data = response.data;
    console.log("[-] Get User : found data for user  -->", data);
    const userId = data[0].user_id;
    const updateUserApiUrl =
      issuerBaseURL + configJson.USER_UPDATE_URL + userId;
    const payload = {
      user_metadata: {
        ...updatedUserMetadata,
      },
    };
    const updateRequest = {
      url: updateUserApiUrl,
      method: "PATCH",
      headers: {
        Authorization: "Bearer " + access_token,
        "content-type": "application/json",
      },
      data: JSON.stringify(payload),
    };

    response = await axios(updateRequest);
    if (response.status !== 200) {
      console.log(
        "[-] Get User (",
        userEmail,
        "): token retrieved ,status code -->",
        response.status
      );
      return new Error(response.data);
    } else {
      return response.data;
    }
  }
};

const updateAccoountParser = (req, res) => {
  const userAccountDetails = req.body;
  if (!userAccountDetails) {
    return res.status(403).json("_Missing userAccountDetails");
  }
  if (!userAccountDetails.email) {
    return res.status(403).json("_Missing user email");
  }
  updateUserMetadata(userAccountDetails.email, userAccountDetails)
    .then((response) => {
      res.status(200).json({ data: response.user_metadata });
    })
    .catch((err) => {
      res.status(500).json({ message: err });
    });
};

// Handle GET requests to /api route
app.get("/api", checkJwt, (req, res) => {
  console.log("App /api");
  res.json({ message: "Hello from server!" });
});

// Handle GET requests for /order route
app.post(
  "/orderPizza",
  checkJwt,
  claimEquals("http://pizza42/email_verified", true),
  (req, res) => {
    console.log(req.body.pizzaSelected);
    res.json({ data: req.body.pizzaSelected + " pizza order is placed" });
  }
);

// Handle Update Account Request

app.post(
  "/updateAccount",
  checkJwt,
  requiredScopes("update:account"),
  claimEquals("https://kreative.net/email_verified", true),
  updateAccoountParser
);

// Test Calls

app.get("/ping", (req, res) => {
  res.json({ message: "Pong" });
});

// Server Listening Port Details

app.listen(PORT, () => {
  console.log(`Server listening on ${PORT}`);
});

// Handle Stripe Payments

// Below is the secret...env fix later
const stripe_secret =
  "--redacted--";

const stripe = require("stripe")(stripe_secret);

app.post("/order", async (req, res) => {
  console.log(JSON.stringify(req.body));
  const { cart, shipping_fee, total_amount } = req.body;
  console.log(shipping_fee);
  const calculateOrderAmount = () => {
    return shipping_fee + total_amount;
  };

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: calculateOrderAmount(),
      currency: "usd",
    });
    res.json({
      statusCode: 200,
      data: JSON.stringify({ clientSecret: paymentIntent.client_secret }),
    });
    console.log(paymentIntent.client_secret);
  } catch (error) {
    // res.json({
    //   data: JSON.stringify({ error: error.message }),
    // });
  }
});
