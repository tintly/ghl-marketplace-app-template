import express, { Express, Request, Response } from "express";
import dotenv from "dotenv";
import { GHL } from "./ghl";
import * as CryptoJS from 'crypto-js'
import { json } from "body-parser";
import { ghlAuthRoutes } from "./auth/ghlAuthRoutes";
import path from "path";
import cors from "cors";

dotenv.config();
const app: Express = express();

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(json({ type: 'application/json' }))

// Initialize GHL
const ghl = new GHL();

const port = process.env.PORT || 3000;

// GHL Authentication routes
app.use('/api/auth', ghlAuthRoutes);

// Existing GHL routes
app.get("/authorize-handler", async (req: Request, res: Response) => {
  const { code } = req.query;
  await ghl.authorizationHandler(code as string);
  res.redirect("https://app.gohighlevel.com/");
});

app.get("/example-api-call", async (req: Request, res: Response) => {
  if (ghl.checkInstallationExists(req.query.companyId as string)) {
    try {
      const request = await ghl
        .requests(req.query.companyId as string)
        .get(`/users/search?companyId=${req.query.companyId}`, {
          headers: {
            Version: "2021-07-28",
          },
        });
      return res.send(request.data);
    } catch (error) {
      console.log(error);
    }
  }
  return res.send("Installation for this company does not exists");
});

app.get("/example-api-call-location", async (req: Request, res: Response) => {
  try {
    if (ghl.checkInstallationExists(req.params.locationId)) {
      const request = await ghl
        .requests(req.query.locationId as string)
        .get(`/contacts/?locationId=${req.query.locationId}`, {
          headers: {
            Version: "2021-07-28",
          },
        });
      return res.send(request.data);
    } else {
      await ghl.getLocationTokenFromCompanyToken(
        req.query.companyId as string,
        req.query.locationId as string
      );
      const request = await ghl
        .requests(req.query.locationId as string)
        .get(`/contacts/?locationId=${req.query.locationId}`, {
          headers: {
            Version: "2021-07-28",
          },
        });
      return res.send(request.data);
    }
  } catch (error) {
    console.log(error);
    res.send(error).status(400)
  }
});

app.post("/example-webhook-handler", async (req: Request, res: Response) => {
  console.log(req.body)
})

app.post("/decrypt-sso", async (req: Request, res: Response) => {
  const { key } = req.body || {}
  if (!key) {
    return res.status(400).send("Please send valid key")
  }
  try {
    const data = ghl.decryptSSOData(key)
    res.send(data)
  } catch (error) {
    res.status(400).send("Invalid Key")
    console.log(error)
  }
})

// Serve static files from the UI build directory
const uiDistPath = path.join(__dirname, '../ui/dist');
app.use(express.static(uiDistPath));

// Serve main HTML file for all other routes (SPA routing)
app.get("*", function (req, res) {
  res.sendFile(path.join(uiDistPath, 'index.html'));
});

app.listen(port, () => {
  console.log(`GHL app listening on port ${port}`);
});