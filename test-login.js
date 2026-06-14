const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jose = require('jose');

const prisma = new PrismaClient();

async function test() {
  try {
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('No user found');
      return;
    }
    
    console.log('Found user:', user.email);
    
    const token = await new jose.SignJWT({ userId: user.id, email: user.email })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(new TextEncoder().encode("this_is_a_test_secret_that_is_long_enough_32"));
      
    console.log('SignJWT successful');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
