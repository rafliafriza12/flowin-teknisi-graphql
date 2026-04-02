import mongoose, { Schema, Document } from "mongoose";

// Permission structure for roles
export interface IRolePermissions {
  readAllContent: boolean;
  writeAllContent: boolean;
  deleteAllContent: boolean;
  categoryManagement: boolean;
  roleManagement: boolean;
  userManagement: boolean;
  generalSettings: boolean;
  notificationSettings: boolean;
  integrationSettings: boolean;
}

export interface IRole {
  name: string;
  displayName: string;
  description?: string;
  permissions: IRolePermissions;
  isSystem: boolean; // System roles like "Super Admin" cannot be deleted
  createdAt: Date;
  updatedAt: Date;
}

export interface IRoleDocument extends IRole, Document {}

const rolePermissionsSchema = new Schema<IRolePermissions>(
  {
    readAllContent: {
      type: Boolean,
      default: false,
    },
    writeAllContent: {
      type: Boolean,
      default: false,
    },
    deleteAllContent: {
      type: Boolean,
      default: false,
    },
    categoryManagement: {
      type: Boolean,
      default: false,
    },
    roleManagement: {
      type: Boolean,
      default: false,
    },
    userManagement: {
      type: Boolean,
      default: false,
    },
    generalSettings: {
      type: Boolean,
      default: false,
    },
    notificationSettings: {
      type: Boolean,
      default: false,
    },
    integrationSettings: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const roleSchema = new Schema<IRoleDocument>(
  {
    name: {
      type: String,
      required: [true, "Role name is required"],
      unique: true,
      trim: true,
    },
    displayName: {
      type: String,
      required: [true, "Display name is required"],
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    permissions: {
      type: rolePermissionsSchema,
      required: true,
      default: () => ({
        readAllContent: false,
        writeAllContent: false,
        deleteAllContent: false,
        categoryManagement: false,
        roleManagement: false,
        userManagement: false,
        generalSettings: false,
        notificationSettings: false,
        integrationSettings: false,
      }),
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster lookups
roleSchema.index({ name: 1 });

export const Role = mongoose.model<IRoleDocument>("Role", roleSchema);
