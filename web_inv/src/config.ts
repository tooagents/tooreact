/**
 * Application Configuration
 * Non-sensitive configuration values that can be committed to version control
 * 
 * For sensitive values, use environment variables via .env (gitignored)
 */

export const config = {
    // API Configuration
    api: {
        baseUrl: import.meta.env.VITE_CORE_API,
        baseGZUrl: import.meta.env.VITE_GZ_API,
        // baseUrl: 'http://localhost:8008',
    },

    // Pagination defaults
    pagination: {
        defaultPageSize: 10,
        maxPageSize: 1000,
        pageSizeOptions: [5, 10, 20, 50, 100],
    },

    // UI Configuration
    ui: {
        defaultTheme: 'light',
        animationsEnabled: true,
    },

    // Feature flags
    features: {
        enableEmployeeSearch: true,
        enableEmployeeEdit: true,
        enableEmployeeDelete: true,
    },
};

export default config;
