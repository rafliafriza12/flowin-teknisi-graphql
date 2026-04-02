import { GraphQLScalarType, Kind } from "graphql";

// DateTime scalar for handling Date objects
export const DateTimeScalar = new GraphQLScalarType({
  name: "DateTime",
  description: "DateTime custom scalar type representing date and time",
  
  // Value sent to the client
  serialize(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === "string") {
      return new Date(value).toISOString();
    }
    throw new Error("DateTime cannot represent non-Date type");
  },
  
  // Value from the client (variables)
  parseValue(value: unknown): Date {
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error("Invalid DateTime");
      }
      return date;
    }
    throw new Error("DateTime cannot represent non-string type");
  },
  
  // Value from the client (inline)
  parseLiteral(ast): Date {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT) {
      const date = new Date(ast.kind === Kind.STRING ? ast.value : parseInt(ast.value, 10));
      if (isNaN(date.getTime())) {
        throw new Error("Invalid DateTime");
      }
      return date;
    }
    throw new Error("DateTime cannot represent non-string type");
  },
});

export const scalarResolvers = {
  DateTime: DateTimeScalar,
};
