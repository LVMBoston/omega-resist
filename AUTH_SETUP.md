# Authentication Setup Guide

## ✅ What's Been Configured

### 1. **Auth Settings**
- ✅ Email confirmation: **AUTO-ENABLED** (no email verification needed for testing)
- ✅ Signups: **ENABLED**
- ✅ Anonymous auth: **DISABLED**

### 2. **Pages Created**
- `/auth` - Login & signup page
- `/admin` - Role management panel (admin only)

### 3. **Protected Routes**
- `/build` - Deck builder (requires authentication)
- `/manage` - Deck manager (requires authentication)
- `/admin` - Admin panel (requires admin role)

### 4. **Public Routes**
- `/` - Home page with deck list
- `/deck/:slug` - Deck viewer (for viral sharing)
- `/auth` - Authentication page

## 🚀 Quick Start

### Step 1: Create Your Account

1. Navigate to `/auth` in your app
2. Click the "Sign Up" tab
3. Enter your email and password (min 6 characters)
4. Click "Sign Up"
5. You'll be automatically signed in

### Step 2: Assign Admin Role

Since you're the first user, you need to manually assign yourself the admin role via SQL:

```sql
-- Get your user ID
SELECT id, email FROM auth.users;

-- Assign admin role (replace 'your-user-id' with actual ID)
INSERT INTO user_roles (user_id, role)
VALUES ('your-user-id', 'admin');
```

Or use the Supabase SQL editor in Lovable Cloud:

<lov-actions>
  <lov-open-backend>Open Backend SQL Editor</lov-open-backend>
</lov-actions>

### Step 3: Access Admin Panel

1. Refresh your app
2. You should now see your role badge and "Admin" button in the header
3. Click "Admin" to manage user roles

## 👥 Role System

### Roles
- **admin**: Full access, can manage users and roles
- **manager**: Can mint tokens and manage campaigns
- **viewer**: Read-only access

### Role Permissions

| Action | Admin | Manager | Viewer |
|--------|-------|---------|--------|
| View campaigns | ✅ | ✅ | ✅ |
| Create campaigns | ✅ | ✅ | ❌ |
| Mint L00 tokens | ✅ | ✅ | ❌ |
| Mint share tokens | ✅ | ✅ | ✅ |
| View analytics | ✅ | ✅ | ✅ |
| Manage user roles | ✅ | ❌ | ❌ |

## 🔐 Security Features

### RLS (Row-Level Security)
All tables are protected with RLS policies:
- `user_roles`: Users can only view their own role; admins can manage all
- `tokens`: Authenticated users can create; everyone can view
- `url_events`: Admins/managers can view; anyone can log via `log_event()`
- `campaigns`, `events_actions`: Everyone can view; admins/managers can modify

### Session Management
- Sessions stored in localStorage
- Auto-refresh enabled
- Automatic redirect to `/auth` if not logged in

## 🧪 Testing the Auth Flow

### Test Scenario 1: Admin User
```typescript
// 1. Sign up as admin
// 2. Assign admin role via SQL
// 3. Access /admin to see all users
// 4. Assign roles to other users
```

### Test Scenario 2: Manager User
```typescript
// 1. Sign up as manager
// 2. Admin assigns manager role
// 3. Can mint L00 tokens
// 4. Cannot access /admin
```

### Test Scenario 3: Viewer User
```typescript
// 1. Sign up as viewer
// 2. Admin assigns viewer role
// 3. Can view campaigns and analytics
// 4. Cannot mint L00 tokens
```

## 🐛 Troubleshooting

### Issue: "Permission denied" when minting tokens
**Solution**: Check that your user has been assigned `admin` or `manager` role.

```sql
-- Check your role
SELECT role FROM user_roles WHERE user_id = auth.uid();
```

### Issue: Can't access admin panel
**Solution**: Only users with `admin` role can access `/admin`.

### Issue: Stuck on loading screen
**Solution**: Check browser console for errors. Make sure Supabase is connected.

### Issue: "User already registered"
**Solution**: Use the "Sign In" tab instead of "Sign Up".

## 📋 Next Steps

Once authentication is working:

1. ✅ Create test campaigns via admin UI (to be built)
2. ✅ Assign campaigns to events/actions
3. ✅ Mint L00 tokens for testing viral flow
4. ✅ Test share functionality (L01-L03)
5. ✅ View analytics dashboard

## 🔗 Related Documentation

- [Viral Tokens System](src/lib/virality/README.md)
- [Testing Playbook](src/lib/virality/test-queries.sql)
- [API Functions](src/lib/virality/mint.ts)
