import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma";
import { IRegisterUser } from "./auth.interface";
import { UserRole, UserStatus } from "../../../generated/prisma/enums";

// resister user
const registerUser = async (payload: IRegisterUser) => {
  const { name, password } = payload;
  const email = payload.email.trim().toLowerCase();

   const isUserExists = await prisma.user.findUnique({
    where: { email },
  });

  if (isUserExists) {
    throw new Error("User with this email already exists");
  }

  const hashedPassword = await bcrypt.hash(password, 8);

  const createUser = await prisma.user.create({
    data:{
      name,
      email,
      password: hashedPassword,
      role: UserRole.PLATFORM_USER,
      status: UserStatus.ACTIVE,
      isEmailVerified: false,
    },
    omit:{
        password : true
    }
  })

  return createUser
};

export const authServices = {
  registerUser,
};
