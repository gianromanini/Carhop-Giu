import bcrypt from "bcryptjs";

async function testAuth() {
  const password = "password123";
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  
  console.log("Password:", password);
  console.log("Hash:", hash);
  
  const isValid = await bcrypt.compare(password, hash);
  console.log("Verification result:", isValid);
  
  const isInvalid = await bcrypt.compare("wrongpassword", hash);
  console.log("Wrong password result:", isInvalid);
}

testAuth();
