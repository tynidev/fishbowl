# Security Vulnerabilities Documentation

## Known Build-Time Vulnerabilities

The following npm audit vulnerabilities are present in the project and are **ACCEPTED** as they pose no runtime security risk:

### Vulnerabilities in react-scripts@5.0.1 dependencies:

1. **nth-check < 2.0.1 (High Severity)**
   - **Location**: `frontend/node_modules/svgo/node_modules/nth-check`
   - **Impact**: Build-time only, used by SVGO (SVG optimizer)
   - **Risk Level**: **Low** - Only affects development builds, not production runtime
   - **Mitigation**: Vulnerability is in build tools, not shipped to production

2. **postcss < 8.4.31 (Moderate Severity)**
   - **Location**: `frontend/node_modules/resolve-url-loader/node_modules/postcss`
   - **Impact**: Build-time only, used by webpack CSS processing
   - **Risk Level**: **Low** - Only affects development builds, not production runtime
   - **Mitigation**: Vulnerability is in build tools, not shipped to production

## Why These Are Acceptable:

1. **Build-time only**: These vulnerabilities exist in tools that process code during development and building, not in the final application that users interact with.

2. **No runtime exposure**: The vulnerable code is not included in the production bundle served to users.

3. **react-scripts limitation**: These are dependencies of `react-scripts@5.0.1` (the latest stable version) and cannot be easily updated without ejecting from Create React App.

4. **Limited attack surface**: An attacker would need access to the development environment to exploit these vulnerabilities.

## Monitoring:

- Check for updates to `react-scripts` regularly
- Re-evaluate when Create React App releases newer versions
- Consider ejecting and manually updating dependencies if critical runtime vulnerabilities are discovered

## Last Updated: May 30, 2025
