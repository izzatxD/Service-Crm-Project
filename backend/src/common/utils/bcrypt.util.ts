import * as bcrypt from 'bcrypt';

type BcryptHash = (data: string, saltOrRounds: number) => Promise<string>;
type BcryptCompare = (data: string, encrypted: string) => Promise<boolean>;

const typedBcrypt = bcrypt as unknown as {
  hash: BcryptHash;
  compare: BcryptCompare;
};

const bcryptHash = typedBcrypt.hash;
const bcryptCompare = typedBcrypt.compare;

export function hashPassword(
  password: string,
  saltRounds = 10,
): Promise<string> {
  return bcryptHash(password, saltRounds);
}

export function comparePassword(
  password: string,
  passwordHash: string,
): Promise<boolean> {
  return bcryptCompare(password, passwordHash);
}
