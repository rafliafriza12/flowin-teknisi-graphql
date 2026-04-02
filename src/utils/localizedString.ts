import { Schema } from "mongoose";

// Mongoose schema definition for localized string fields
export const localizedStringSchema = {
  en: { type: String, default: "" },
  id: { type: String, default: "" },
};

// Required localized string schema
export const localizedStringRequiredSchema = {
  en: { type: String, required: true },
  id: { type: String, required: true },
};

// Helper to create localized string sub-schema for arrays
export const createLocalizedStringSubSchema = () => {
  return new Schema(
    {
      en: { type: String, default: "" },
      id: { type: String, default: "" },
    },
    { _id: false }
  );
};
