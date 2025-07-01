// scripts/migrate-sterni.js
require("dotenv").config();       // if you use a .env for MONGODB_URI
require("../db/index");          // this will connect mongoose as in your db/index.js
const Spaeti = require("../models/Spaeti.model");

async function migrate() {
  console.log("🔗 Using existing Mongoose connection…");

  const allSpaetis = await Spaeti.find({});
  console.log(`Found ${allSpaetis.length} Spaeti documents`);

  for (let spa of allSpaetis) {
    // take old numeric value (or 0 if missing)
    const old = typeof spa.sterni === "number" ? spa.sterni : 0;

    // set the new fields
    spa.sterniHistory = [old];
    spa.sternAvg      = old;

    // remove the old field entirely
    spa.sterni = undefined;

    await spa.save();
    console.log(`✅ Migrated ${spa._id} (old=${old})`);
  }

  console.log("🎉 Migration complete. You can now remove references to `sterni`.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
