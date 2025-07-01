// scripts/reset-sterni-history.js

require("dotenv").config();       // load MONGODB_URI if you use it
require("../db/index");          // your mongoose connection
const Spaeti = require("../models/Spaeti.model");

async function resetHistory() {
  console.log("🔄 Resetting sterniHistory and sternAvg from old `sterni`…");

  // Update all docs: set history=[old], avg=old (as double), then unset `sterni`
  await Spaeti.collection.updateMany(
    {},
    [
      {
        $set: {
          sterniHistory: [
            {
              $convert: {
                input: { $ifNull: ["$sterni", 0] },
                to: "double",
                onError: 0.0,
                onNull: 0.0
              }
            }
          ],
          sternAvg: {
            $convert: {
              input: { $ifNull: ["$sterni", 0] },
              to: "double",
              onError: 0.0,
              onNull: 0.0
            }
          }
        }
      }
    ]
  );

  console.log("✅ Migration complete. All documents now have sterniHistory and sternAvg.");
  process.exit(0);
}

resetHistory().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
