export interface IRegisterUser {
  name: string;
  email: string;
  password: string;
}

export interface IForgotPassword {
  email: string
}

export interface IResetPassword {
  email: string;
  otp: string;
  newPassword: string;
}