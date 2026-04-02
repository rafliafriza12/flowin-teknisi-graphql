import mongoose, { Schema, Document } from "mongoose";

export interface ISettings {
  general: {
    defaultLanguage: "bahasa" | "english";
    timezone: string;
    dateFormat: "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY/MM/DD";
    timeFormat: "12h" | "24h";
  };
  notifications: {
    systemNotification: boolean;
    reviewNotification: boolean;
    emailAlerts: boolean;
    digestFrequency: "daily" | "weekly" | "monthly";
  };
  integrations: {
    analystics: boolean;
    crm: boolean;
  };
}

export interface ISettingsDocument extends ISettings, Document {}
const settingsSchema = new Schema<ISettingsDocument>(
  {
    general: {
      defaultLanguage: {
        type: String,
        enum: ["bahasa", "english"],
        default: "english",
      },
      timezone: {
        type: String,
        default: "GMT+7 (Jakarta)",
      },
      dateFormat: {
        type: String,
        enum: ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY/MM/DD"],
        default: "DD/MM/YYYY",
      },
      timeFormat: {
        type: String,
        enum: ["12h", "24h"],
        default: "24h",
      },
    },
    notifications: {
      systemNotification: {
        type: Boolean,
        default: true,
      },
      reviewNotification: {
        type: Boolean,
        default: true,
      },
      emailAlerts: {
        type: Boolean,
        default: true,
      },
      digestFrequency: {
        type: String,
        enum: ["daily", "weekly", "monthly"],
        default: "weekly",
      },
    },
    integrations: {
        analystics: {
        type: Boolean,
        default: true,
      },
      crm: {
        type: Boolean,
        default: false,
      },
    }
  },
  {
    timestamps: true,
  }
);

export const Settings = mongoose.model<ISettingsDocument>(
  "Settings",
  settingsSchema
);
