const bcrypt = require("bcrypt");

async function generateSalt() {
  const salt = await bcrypt.genSalt(10);
  console.log(salt);
}

generateSalt();

async function generateSaltReturn() {
  const salt = await bcrypt.genSalt(10);
  return salt;
}

generateSaltReturn().then((salt) => console.log(salt));

const generateSaltSync = () => {
  return bcrypt.genSaltSync(10);
};

console.log(generateSaltSync());

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);
  return hashedPassword;
};

hashPassword("123456").then((hashedPassword) => console.log(hashedPassword));
