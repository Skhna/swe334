const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

async function sendOTPEmail(to, otp) {
  // ✅ DEBUG (түр): ENV орж ирж байна уу?
  console.log("EMAIL_USER:", process.env.EMAIL_USER);
  console.log("EMAIL_PASSWORD exists:", !!process.env.EMAIL_PASSWORD);

  return transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject: "Your OTP code",
    text: `Your OTP is: ${otp} (valid 10 minutes)`,
  });
}

module.exports = { sendOTPEmail };
