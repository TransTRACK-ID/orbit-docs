import { db } from "./index";
import { releases, appVersions, apps } from "./schema";
import { eq } from "drizzle-orm";

async function check() {
  // Find Postrack app
  const app = await db.select().from(apps).where(eq(apps.name, "Postrack")).limit(1).then(rows => rows[0]);
  if (!app) {
    console.log("Postrack app not found");
    return;
  }
  
  // Find version 0.8.7
  const version = await db.select().from(appVersions).where(eq(appVersions.version, "0.8.7")).limit(1).then(rows => rows[0]);
  if (!version) {
    console.log("Version 0.8.7 not found");
    return;
  }
  
  console.log("App ID:", app.id);
  console.log("Version ID:", version.id);
  console.log("Version releaseNotes length:", version.releaseNotes?.length || 0);
  
  // Find releases for this version
  const releaseRows = await db.select().from(releases).where(eq(releases.versionId, version.id));
  console.log("\nReleases for 0.8.7:");
  for (const r of releaseRows) {
    console.log("  ID:", r.id);
    console.log("  Type:", r.type);
    console.log("  Has summary:", !!r.summary);
    console.log("  Has categories:", !!r.categories);
    console.log("  Categories:", JSON.stringify(r.categories));
    console.log("  Published:", r.published);
    console.log("---");
  }
}

check().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
