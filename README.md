# Bumi Resource GraphQL API

A modern GraphQL API built with Apollo Server, Express.js, MongoDB, and TypeScript. Deployed on Vercel as a serverless function.

## 🚀 Features

- **GraphQL API** with Apollo Server 4
- **MongoDB** database with Mongoose ODM
- **TypeScript** for type safety
- **Serverless deployment** on Vercel
- **Modular architecture** with separation of concerns
- **Pagination** support for list queries
- **Error handling** with custom GraphQL errors
- **Authentication** with JWT (access & refresh tokens)
- **Deep merge support** for partial nested object updates
- **Environment-based configuration**

## 📁 Project Structure

```
src/
├── config/              # Configuration files
│   ├── index.ts         # Main config (env variables)
│   └── database.ts      # MongoDB connection
│
├── graphql/             # GraphQL layer
│   ├── typeDefs/        # GraphQL type definitions (schemas)
│   │   ├── base.ts      # Base types, scalars, pagination
│   │   ├── user.ts      # User type definitions
│   │   ├── news.ts      # News type definitions
│   │   └── index.ts     # Export all typeDefs
│   │
│   ├── resolvers/       # GraphQL resolvers
│   │   ├── userResolver.ts
│   │   ├── newsResolver.ts
│   │   └── index.ts     # Merge all resolvers
│   │
│   ├── scalars/         # Custom GraphQL scalars
│   │   ├── DateTime.ts
│   │   └── index.ts
│   │
│   └── index.ts         # Export typeDefs & resolvers
│
├── models/              # Mongoose models
│   ├── User.ts
│   ├── News.ts
│   └── index.ts
│
├── services/            # Business logic layer
│   ├── userService.ts
│   ├── newsService.ts
│   └── index.ts
│
├── middlewares/         # Express middlewares
│   ├── errorHandler.ts
│   └── index.ts
│
├── utils/               # Utility functions
│   ├── errors.ts        # Custom error classes
│   ├── helpers.ts       # Helper functions
│   └── index.ts
│
├── types/               # TypeScript types
│   └── context.ts       # GraphQL context types
│
├── app.ts               # Express & Apollo Server setup
└── server.ts            # Server entry point
```

## 🛠️ Local Development

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd bumi-resource-backend
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and fill in required values:
   ```bash
   MONGODB_URI=your-mongodb-connection-string
   JWT_ACCESS_SECRET=your-access-secret-min-32-chars
   JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars
   CORS_ORIGIN=http://localhost:3000
   ```

4. **Start development server**
   ```bash
   pnpm dev
   ```

## 🚢 Vercel Deployment

### Prerequisites
- Vercel account ([sign up](https://vercel.com/signup))
- MongoDB Atlas database (or any MongoDB instance accessible from the internet)
- Vercel CLI (optional): `npm i -g vercel`

### Deploy Steps

#### Option 1: Using Vercel Dashboard (Recommended)

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Import to Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Add New Project"
   - Import your GitHub repository
   - Configure project:
     - **Framework Preset**: Other
     - **Build Command**: `pnpm vercel-build`
     - **Output Directory**: Leave empty

3. **Add Environment Variables**
   
   In Vercel project settings, add these variables:
   
   | Variable | Value | Required |
   |----------|-------|----------|
   | `NODE_ENV` | `production` | ✅ |
   | `MONGODB_URI` | Your MongoDB connection string | ✅ |
   | `JWT_ACCESS_SECRET` | Secure random string (min 32 chars) | ✅ |
   | `JWT_REFRESH_SECRET` | Secure random string (min 32 chars) | ✅ |
   | `CORS_ORIGIN` | Your frontend URL(s), comma-separated | ✅ |
   | `GRAPHQL_PATH` | `/graphql` | Optional |
   | `PORT` | `4000` | Optional |
   
   **Generate secure secrets:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

4. **Deploy**
   - Click "Deploy"
   - Wait for deployment to complete
   - Your API will be available at: `https://your-project.vercel.app/graphql`

#### Option 2: Using Vercel CLI

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```
   
   Follow the prompts to configure your project.

4. **Add environment variables**
   ```bash
   vercel env add MONGODB_URI
   vercel env add JWT_ACCESS_SECRET
   vercel env add JWT_REFRESH_SECRET
   vercel env add CORS_ORIGIN
   ```

5. **Deploy to production**
   ```bash
   vercel --prod
   ```

### MongoDB Atlas Setup (Recommended)

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Whitelist Vercel IPs or use `0.0.0.0/0` (all IPs)
3. Create a database user
4. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/database`

### Post-Deployment Testing

Test your deployed API:

```bash
curl -X POST https://your-project.vercel.app/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'
```

Or visit: `https://your-project.vercel.app/graphql` in your browser for GraphQL Playground.

## 📝 Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | ✅ | `development` |
| `MONGODB_URI` | MongoDB connection string | ✅ | - |
| `JWT_ACCESS_SECRET` | JWT access token secret (min 32 chars) | ✅ | - |
| `JWT_REFRESH_SECRET` | JWT refresh token secret (min 32 chars) | ✅ | - |
| `CORS_ORIGIN` | Allowed origins (comma-separated) | ✅ | `*` |
| `PORT` | Server port (local dev only) | ❌ | `4000` |
| `GRAPHQL_PATH` | GraphQL endpoint path | ❌ | `/graphql` |
| `JWT_ACCESS_EXPIRES_IN` | Access token expiry | ❌ | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry | ❌ | `7d` |

## 🔗 API Endpoints

### Local Development
- **GraphQL Playground**: `http://localhost:4000/graphql`

### Production (Vercel)
- **GraphQL API**: `https://your-project.vercel.app/graphql`
- **GraphQL Playground**: Enabled in production for testing

## 📊 GraphQL Schema

### Queries

```graphql
# Users
users(filter: UserFilterInput, pagination: PaginationInput): UsersResponse!
user(id: ID!): User
userByEmail(email: String!): User

# News
allNews(filter: NewsFilterInput, pagination: PaginationInput): NewsResponse!
publishedNews(pagination: PaginationInput): NewsResponse!
news(id: ID!): News
newsBySlug(slug: String!): News
newsByCategory(category: String!, pagination: PaginationInput): [News!]!
categories: [String!]!
popularTags(limit: Int): [TagWithCount!]!
```

### Mutations

```graphql
# Users
createUser(input: CreateUserInput!): User!
updateUser(id: ID!, input: UpdateUserInput!): User!
deleteUser(id: ID!): Boolean!
toggleUserStatus(id: ID!): User!

# News
createNews(input: CreateNewsInput!): News!
updateNews(id: ID!, input: UpdateNewsInput!): News!
deleteNews(id: ID!): Boolean!
incrementViewCount(id: ID!): News!
publishNews(id: ID!): News!
archiveNews(id: ID!): News!
```

## 🧪 Example Queries

### Create a User

```graphql
mutation {
  createUser(input: {
    name: "John Doe"
    email: "john@example.com"
    password: "password123"
    role: user
  }) {
    id
    name
    email
    role
    createdAt
  }
}
```

### Get Users with Pagination

```graphql
query {
  users(
    filter: { role: user, isActive: true }
    pagination: { page: 1, limit: 10 }
  ) {
    users {
      id
      name
      email
      role
    }
    pageInfo {
      total
      page
      totalPages
      hasNextPage
    }
  }
}
```

### Create News

```graphql
mutation {
  createNews(input: {
    title: "Breaking News"
    content: "This is the news content..."
    category: "Technology"
    tags: ["tech", "innovation"]
    authorId: "user_id_here"
    status: published
  }) {
    id
    title
    slug
    author {
      name
    }
    publishedAt
  }
}
```

### Get Published News

```graphql
query {
  publishedNews(pagination: { page: 1, limit: 5 }) {
    news {
      id
      title
      slug
      excerpt
      category
      author {
        name
      }
      publishedAt
      viewCount
    }
    pageInfo {
      total
      hasNextPage
    }
  }
}
```

## 📜 Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start development server with hot reload |
| `pnpm build` | Build for production |
| `pnpm start` | Start production server |
| `pnpm typecheck` | Run TypeScript type checking |

## 🏗️ Architecture

This project follows a **layered architecture** pattern:

1. **GraphQL Layer** (typeDefs + resolvers): Handles GraphQL schema and request processing
2. **Service Layer**: Contains business logic
3. **Model Layer**: Mongoose models and database schemas
4. **Config Layer**: Environment and application configuration

### Best Practices Implemented

- ✅ Separation of concerns
- ✅ Type-safe with TypeScript
- ✅ Modular GraphQL schema (schema stitching)
- ✅ Custom scalars for complex types
- ✅ Pagination support
- ✅ Error handling with custom errors
- ✅ Environment-based configuration
- ✅ Database indexing for performance
- ✅ Graceful shutdown handling

## 📄 License

ISC
