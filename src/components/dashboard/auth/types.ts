// Shared by the login / sign-up server actions and the form. Values are keys under Dashboard.errors.
export type AuthFieldError =
  | "nameEmpty"
  | "nameLong"
  | "emailInvalid"
  | "passwordShort"
  | "passwordLong";

export type AuthFieldErrors = Partial<Record<"full_name" | "email" | "password", AuthFieldError>>;

export type AuthFormState = {
  error?: "invalidCredentials" | "emailTaken" | "rateLimit" | "generic" | "passwordShort" | "emailInvalid";
  fields?: AuthFieldErrors;
  values?: { email?: string; full_name?: string };
};
