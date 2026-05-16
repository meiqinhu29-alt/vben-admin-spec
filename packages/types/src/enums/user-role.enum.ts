export enum UserRole {
  Admin = 'admin',
  Boss = 'boss',
  Finance = 'finance',
  Manager = 'manager',
  Staff = 'staff',
}

export const ALL_USER_ROLES: UserRole[] = [
  UserRole.Staff,
  UserRole.Manager,
  UserRole.Finance,
  UserRole.Boss,
  UserRole.Admin,
];
