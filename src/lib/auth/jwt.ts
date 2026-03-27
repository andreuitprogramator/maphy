import jwt from "jsonwebtoken";

export type JwtUser = {
  sub: string;
  username: string;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");
  return secret;
}

export function signAccessToken(user: JwtUser) {
  return jwt.sign(user, getJwtSecret(), { expiresIn: "30d" });
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, getJwtSecret()) as JwtUser & jwt.JwtPayload;
}

