# src/lib/auth.ts

[Source](../../../../../src/lib/auth.ts)

| Symbol | Kind | Line | Parameters |
|---|---|---:|---|
| `UserRole` | type | [L18](../../../../../src/lib/auth.ts#L18) |  |
| `UserProfile` | interface | [L20](../../../../../src/lib/auth.ts#L20) |  |
| `SignUpData` | interface | [L32](../../../../../src/lib/auth.ts#L32) |  |
| `SignInData` | interface | [L40](../../../../../src/lib/auth.ts#L40) |  |
| `AuthResult` | interface | [L45](../../../../../src/lib/auth.ts#L45) |  |
| `createSupabaseClient` | function | [L59](../../../../../src/lib/auth.ts#L59) |  |
| `createSupabaseServerClient` | function | [L69](../../../../../src/lib/auth.ts#L69) |  |
| `signUp` | function | [L83](../../../../../src/lib/auth.ts#L83) | data |
| `signIn` | function | [L129](../../../../../src/lib/auth.ts#L129) | data |
| `signOut` | function | [L152](../../../../../src/lib/auth.ts#L152) |  |
| `getSession` | function | [L168](../../../../../src/lib/auth.ts#L168) |  |
| `getUser` | function | [L178](../../../../../src/lib/auth.ts#L178) |  |
| `getUserRole` | function | [L188](../../../../../src/lib/auth.ts#L188) | user |
| `isProfessional` | function | [L196](../../../../../src/lib/auth.ts#L196) | user |
| `isRenterBuyer` | function | [L203](../../../../../src/lib/auth.ts#L203) | user |
| `getUserProfile` | function | [L214](../../../../../src/lib/auth.ts#L214) | userId |
| `updateUserProfile` | function | [L243](../../../../../src/lib/auth.ts#L243) | userId, updates |
| `sendMagicLink` | function | [L275](../../../../../src/lib/auth.ts#L275) | email, role |
| `signInWithGoogle` | function | [L304](../../../../../src/lib/auth.ts#L304) | role |
| `onAuthStateChange` | function | [L323](../../../../../src/lib/auth.ts#L323) | callback |

Imports: `@supabase/ssr`, `@supabase/supabase-js`
