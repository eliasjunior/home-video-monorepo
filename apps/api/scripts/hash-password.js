const bcrypt = require("bcrypt");

const password = process.argv[2];
const rounds = Number(process.argv[3] || 10);

if (!password) {
  console.error("Usage: node scripts/hash-password.js <password> [rounds]");
  process.exit(1);
}

bcrypt
  .hash(password, rounds)
  .then((hash) => {
    console.log(hash);
  })
  .catch((err) => {
    console.error("Failed to hash password", err);
    process.exit(1);
  });
