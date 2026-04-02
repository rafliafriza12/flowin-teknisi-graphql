import { scalarResolvers } from "../scalars";
import authResolver from "./authResolver";
import userResolver from "./userResolver";
import roleResolver from "./roleResolver";
import { withPermissions } from "../../middlewares";

const mergeResolvers = (...resolversArray: Record<string, unknown>[]) => {
  const merged: Record<string, unknown> = {};

  for (const resolvers of resolversArray) {
    for (const [key, value] of Object.entries(resolvers)) {
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        merged[key] = {
          ...((merged[key] as Record<string, unknown>) || {}),
          ...(value as Record<string, unknown>),
        };
      } else {
        merged[key] = value;
      }
    }
  }

  return merged;
};

const rawResolvers = mergeResolvers(
  scalarResolvers,
  authResolver,
  userResolver,
  roleResolver,
);

const resolvers = withPermissions(rawResolvers);

export default resolvers;
