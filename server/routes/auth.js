
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

const router = Router();

const otpStore = new Map();

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

// -----------------------------
// Helpers
// -----------------------------

function normalizePhone(phone) {
  return String(phone || "").replace(/[()\s-]/g, "");
}

function validPhone(phone) {
  // International format, e.g. +97798XXXXXXXX
  return /^\+[1-9]\d{7,14}$/.test(phone);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}

function issueToken(user) {
  return jwt.sign(
    { sub: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function publicUser(user) {
  return {
    id: user._id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    phoneVerified: user.phoneVerified,
  };
}

function sendTwilioRequest(url, accountSid, authToken, body) {
  return fetch(url, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
}

// -----------------------------
// Request OTP
// -----------------------------

router.post("/request-otp", async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body.phone);

    if (!validPhone(phone)) {
      return res.status(400).json({
        message:
          "Enter a valid international phone number, e.g. +97798XXXXXXXX.",
      });
    }

    // Development OTP mode
    if (process.env.DEV_OTP === "true") {
      const code = String(
        Math.floor(100000 + Math.random() * 900000)
      );

      otpStore.set(phone, {
        code,
        expiresAt: Date.now() + OTP_TTL_MS,
        attempts: 0,
      });

      console.log(
        `[DEV OTP] Phone: ${phone} | Code: ${code} | Valid for 5 minutes`
      );

      return res.json({
        message:
          "Development OTP generated. Check the backend terminal.",
      });
    }

    // Twilio configuration
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

    if (!accountSid || !authToken || !serviceSid) {
      return res.status(503).json({
        message:
          "SMS service is not configured. Configure Twilio credentials or enable DEV_OTP for local testing.",
      });
    }

    const url =
      `https://verify.twilio.com/v2/Services/` +
      `${serviceSid}/Verifications`;

    const response = await sendTwilioRequest(
      url,
      accountSid,
      authToken,
      {
        To: phone,
        Channel: "sms",
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error("Twilio OTP request failed:", data);

      return res.status(502).json({
        message:
          data.message ||
          "Twilio could not send the verification code.",
      });
    }

    return res.json({
      message: "Verification code sent by SMS.",
    });
  } catch (error) {
    next(error);
  }
});

// -----------------------------
// Register
// -----------------------------

router.post("/register", async (req, res, next) => {
  try {
    const username = String(req.body.username || "")
      .trim()
      .toLowerCase();

    const fullName = String(req.body.fullName || "").trim();

    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    const phone = normalizePhone(req.body.phone);

    const password = req.body.password;

    const otp = String(req.body.otp || "").trim();

    // Validate username
    if (!/^[a-z0-9_.]{3,30}$/.test(username)) {
      return res.status(400).json({
        message:
          "Username must be 3–30 characters and contain only letters, numbers, dots, or underscores.",
      });
    }

    // Validate full name
    if (fullName.length < 2) {
      return res.status(400).json({
        message: "Enter your full name.",
      });
    }

    // Validate email
    if (!validEmail(email)) {
      return res.status(400).json({
        message: "Enter a valid email address.",
      });
    }

    // Validate phone
    if (!validPhone(phone)) {
      return res.status(400).json({
        message:
          "Enter a valid international mobile number, e.g. +97798XXXXXXXX.",
      });
    }

    // Validate password
    if (!validPassword(password)) {
      return res.status(400).json({
        message:
          "Password must be at least 8 characters and include uppercase, lowercase, and a number.",
      });
    }

    // Validate OTP format
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message: "Enter the 6-digit OTP.",
      });
    }

    // -----------------------------
    // Development OTP verification
    // -----------------------------

    if (process.env.DEV_OTP === "true") {
      const saved = otpStore.get(phone);

      if (!saved) {
        return res.status(400).json({
          message:
            "No OTP was requested for this phone number. Request a new code.",
        });
      }

      if (saved.expiresAt < Date.now()) {
        otpStore.delete(phone);

        return res.status(400).json({
          message: "OTP has expired. Request a new code.",
        });
      }

      if (saved.attempts >= MAX_OTP_ATTEMPTS) {
        otpStore.delete(phone);

        return res.status(429).json({
          message:
            "Too many OTP attempts. Request a new verification code.",
        });
      }

      if (saved.code !== otp) {
        saved.attempts += 1;

        return res.status(400).json({
          message: "Incorrect OTP. Please try again.",
        });
      }

      // OTP is correct
      otpStore.delete(phone);
    } else {
      // -----------------------------
      // Twilio OTP verification
      // -----------------------------

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

      if (!accountSid || !authToken || !serviceSid) {
        return res.status(503).json({
          message: "SMS verification is not configured.",
        });
      }

      const url =
        `https://verify.twilio.com/v2/Services/` +
        `${serviceSid}/VerificationChecks`;

      const response = await sendTwilioRequest(
        url,
        accountSid,
        authToken,
        {
          To: phone,
          Code: otp,
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.status !== "approved") {
        return res.status(400).json({
          message:
            data.message ||
            "OTP is invalid or expired.",
        });
      }
    }

    // -----------------------------
    // Check existing user
    // -----------------------------

    const existing = await User.findOne({
      $or: [
        { username },
        { email },
        { phone },
      ],
    });

    if (existing) {
      return res.status(409).json({
        message:
          "Username, email, or mobile number is already registered.",
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await User.create({
      username,
      fullName,
      email,
      phone,
      passwordHash,
      phoneVerified: true,
    });

    // Return token and user
    return res.status(201).json({
      message: "Account created successfully.",
      token: issueToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        message:
          "Username, email, or mobile number is already registered.",
      });
    }

    next(error);
  }
});

// -----------------------------
// Login
// -----------------------------

router.post("/login", async (req, res, next) => {
  try {
    const login = String(req.body.login || "")
      .trim()
      .toLowerCase();

    const password = String(req.body.password || "");

    if (!login || !password) {
      return res.status(400).json({
        message:
          "Enter your username/email and password.",
      });
    }

    const user = await User.findOne({
      $or: [
        { username: login },
        { email: login },
      ],
    });

    if (
      !user ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).json({
        message:
          "Incorrect username/email or password.",
      });
    }

    return res.json({
      message: "Login successful.",
      token: issueToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

// -----------------------------
// Get logged-in user
// -----------------------------

router.get("/me", async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";

    const token = header.startsWith("Bearer ")
      ? header.slice(7)
      : "";

    if (!token) {
      return res.status(401).json({
        message: "Not signed in.",
      });
    }

    const payload = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    const user = await User.findById(payload.sub);

    if (!user) {
      return res.status(401).json({
        message: "Account not found.",
      });
    }

    return res.json({
      user: publicUser(user),
    });
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return res.status(401).json({
        message: "Session expired. Please sign in again.",
      });
    }

    next(error);
  }
});

export default router;
