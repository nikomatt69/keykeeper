# KeyKeeper Authentication Flow Refactoring Plan

This plan outlines the steps to refactor the KeyKeeper application's authentication flow to meet the following requirements:
1.  **App Launch**: When the app opens, the user should either create an account or log in.
2.  **First Login**: After the *first successful login* (meaning, the user account is created and authenticated), the user should be prompted to create a master password.
3.  **Subsequent Logins**: If the user has already created a master password, they should only need to enter it after logging in to proceed to the main application (`index` app).

This refactoring will separate user account management from vault master password management.

## Phase 1: Backend (Rust) Modifications

### Step 1.1: Add New Tauri Commands
Introduce new commands to query the state of the user account and master password.

*   **File**: `src-tauri/src/main.rs`
*   **Changes**:
    *   Add `is_user_account_created` command:
        ```rust
        #[tauri::command]
        async fn is_user_account_created(state: State<'_', AppState>) -> Result<bool, String> {
            let vault_guard = state.vault.lock().await;
            Ok(vault_guard.user_account.is_some())
        }
        ```
    *   Add `is_master_password_set` command:
        ```rust
        #[tauri::command]
        async fn is_master_password_set(state: State<'_', AppState>) -> Result<bool, String> {
            let vault_guard = state.vault.lock().await;
            Ok(vault_guard.master_password_hash.is_some())
        }
        ```
    *   Register these new commands in `tauri::generate_handler!`.

### Step 1.2: Refactor `unlock_vault` Command
Modify `unlock_vault` to *only* verify the master password. It should no longer handle the initial setup.

*   **File**: `src-tauri/src/main.rs`
*   **Changes**:
    *   Remove the `else` block that calls `set_master_password` for first-time setup.
    *   If `master_password_hash` is `None`, `unlock_vault` should return an error, as `set_master_password` will be called explicitly from the frontend.
    ```rust
    #[tauri::command]
    async fn unlock_vault(
        password: String,
        state: State<'_', AppState>,
    ) -> Result<bool, String> {
        let vault_guard = state.vault.lock().await;
        
        if let Some(stored_hash) = &vault_guard.master_password_hash {
            let is_valid = verify(&password, stored_hash).map_err(|e| e.to_string())?;
            if is_valid {
                drop(vault_guard);
                *state.is_unlocked.lock().await = true;
                log_audit_event(&state, "unlock_vault", "vault", None, true, None).await;
                Ok(true)
            } else {
                log_audit_event(&state, "unlock_vault", "vault", None, false, Some("Invalid password")).await;
                Ok(false)
            }
        } else {
            // Master password not set, this command should not be called in this state
            log_audit_event(&state, "unlock_vault", "vault", None, false, Some("Master password not set")).await;
            Err("Master password not set. Please set it first.".to_string())
        }
    }
    ```

### Step 1.3: Ensure `set_master_password` is Callable Independently
Confirm `set_master_password` can be called directly to set the master password and generate encryption keys. This command will be used after user login if no master password exists.

*   **File**: `src-tauri/src/main.rs`
*   **Changes**: No changes needed, but verify its current implementation is suitable for direct invocation. It already handles hashing and key generation.

### Step 1.4: Modify `authenticate_user` to Return a Clear Success/Failure
Ensure `authenticate_user` returns a simple `bool` indicating success or failure, which is already the case.

*   **File**: `src-tauri/src/main.rs`
*   **Changes**: No changes needed.

## Phase 2: Frontend (Next.js) Modifications

### Step 2.1: Update `lib/tauri-api.ts`
Add new methods corresponding to the new Tauri commands.

*   **File**: `lib/tauri-api.ts`
*   **Changes**:
    *   Add `isUserAccountCreated()`:
        ```typescript
        static async isUserAccountCreated(): Promise<boolean> {
            return await invoke('is_user_account_created');
        }
        ```
    *   Add `isMasterPasswordSet()`:
        ```typescript
        static async isMasterPasswordSet(): Promise<boolean> {
            return await invoke('is_master_password_set');
        }
        ```

### Step 2.2: Refactor `lib/store.ts`
Manage new authentication states and actions.

*   **File**: `lib/store.ts`
*   **Changes**:
    *   Add new state variables:
        ```typescript
        isUserLoggedIn: boolean;
        hasMasterPassword: boolean;
        ```
    *   Add new actions:
        ```typescript
        setIsUserLoggedIn: (loggedIn: boolean) => void;
        setHasMasterPassword: (has: boolean) => void;
        loginUser: (email: string, password: string) => Promise<boolean>;
        registerUser: (email: string, password: string) => Promise<boolean>;
        ```
    *   Modify `unlockVault` to remove the initial setup logic, as it's now handled by `setMasterPassword` after user login.
    *   Implement `loginUser` and `registerUser` actions using `invoke('authenticate_user')` and `invoke('create_user_account')` respectively. Update `isUserLoggedIn` state.

### Step 2.3: Refactor `pages/index.tsx`
Implement the new authentication flow logic. This will be the most significant change in the frontend.

*   **File**: `pages/index.tsx`
*   **Changes**:
    *   Introduce new state variables: `isUserAccountCreated`, `isUserLoggedIn`, `hasMasterPassword`.
    *   Modify `useEffect` to:
        1.  Check `is_user_account_created`.
        2.  If `false`, set a state to prompt for registration/initial login.
        3.  If `true`, set a state to prompt for user login.
        4.  After successful user login, check `is_master_password_set`.
        5.  If `false`, set a state to prompt for master password creation.
        6.  If `true`, set a state to prompt for vault unlock.
    *   Conditionally render different components/modes of `LoginScreen` based on these states. This might involve creating a new component for "Set Master Password".

### Step 2.4: Refactor `components/LoginScreen.tsx`
Adapt `LoginScreen` to handle the different authentication phases. It might be split into smaller, more focused components or use a more complex internal state.

*   **File**: `components/LoginScreen.tsx`
*   **Changes**:
    *   Modify `LoginScreen` to accept props that dictate its current mode (e.g., `mode: 'userLogin' | 'userRegister' | 'masterPasswordSetup' | 'vaultUnlock'`).
    *   Adjust form fields and submission logic based on the mode.
    *   The existing `LoginMode` enum can be extended or replaced.

## Phase 3: Testing and Verification

### Step 3.1: Compile and Test Backend
Compile the Rust backend and ensure all new and modified Tauri commands work as expected.

*   **Command**: `cargo build` (in `src-tauri`)
*   **Verification**: Manual testing of commands via a simple test harness or by running the app.

### Step 3.2: Compile and Test Frontend
Compile the Next.js frontend and ensure the new authentication flow is correctly implemented.

*   **Command**: `npm run build` (in root)
*   **Verification**:
    *   Run the app (`npm run tauri dev`).
    *   Verify the initial flow: register new user -> login -> set master password -> access main app.
    *   Verify subsequent flow: login with existing user -> unlock vault -> access main app.
    *   Verify error handling for incorrect credentials.

### Step 3.3: Production Readiness Checks
Ensure the application is ready for production.

*   **Command**: `npm run tauri build`
*   **Verification**:
    *   Check for any build errors or warnings.
    *   Ensure the final bundled application functions correctly.
    *   Review `tauri.conf.json` for release configurations.

## Rollback Plan

In case of critical issues, revert to the previous commit.
*   `git reset --hard <previous_commit_hash>`

---
