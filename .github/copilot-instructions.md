# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

## Adapter-Specific Context
- **Adapter Name**: iobroker.pvforecast
- **Primary Function**: Solar plant production forecast using external APIs (Solcast, Forecast.Solar)
- **Key Dependencies**: External weather/solar APIs, coordinate-based forecasting, JSON data processing
- **Configuration Requirements**: API keys, latitude/longitude coordinates, polling intervals, plant specifications (kWp)
- **Data Types**: Time-series solar power/energy predictions, current power estimates, daily/hourly forecasts
- **Connection Type**: Cloud-based API polling with configurable intervals
- **Special Considerations**: API rate limits, encrypted API key storage, timezone handling for forecasts

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();
                        
                        // Get adapter object using promisified pattern
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });
                        
                        if (!obj) {
                            return reject(new Error('Adapter object not found'));
                        }

                        // Configure adapter properties
                        Object.assign(obj.native, {
                            position: TEST_COORDINATES,
                            createCurrently: true,
                            createHourly: true,
                            createDaily: true,
                            // Add other configuration as needed
                        });

                        // Set the updated configuration
                        harness.objects.setObject(obj._id, obj);

                        console.log('✅ Step 1: Configuration written, starting adapter...');
                        
                        // Start adapter and wait
                        await harness.startAdapterAndWait();
                        
                        console.log('✅ Step 2: Adapter started');

                        // Wait for adapter to process data
                        const waitMs = 15000;
                        await wait(waitMs);

                        console.log('🔍 Step 3: Checking states after adapter run...');
                        
                        // Verify expected states exist
                        const currentlyState = await harness.states.getStateAsync('your-adapter.0.summary.current');
                        if (currentlyState) {
                            console.log('✅ Step 4: Current state found');
                        } else {
                            console.log('❌ Step 4: Current state not found');
                        }

                        resolve();
                        
                    } catch (error) {
                        console.error('❌ Test failed:', error);
                        reject(error);
                    }
                });
            }).timeout(60000);
        });
    }
});
```

#### Best Practices for Integration Tests

1. **Use official @iobroker/testing framework exclusively**
2. **Test with realistic configurations** matching your adapter's requirements
3. **Implement proper async/await patterns** with Promise wrappers for callback-based ioBroker APIs
4. **Allow sufficient timeouts** for API calls and data processing (30-60 seconds typical)
5. **Validate key state objects** that your adapter creates
6. **Test both success and error scenarios** where possible
7. **Clean up resources** in test teardown methods

## Error Handling Best Practices

### API Error Handling
For adapters connecting to external APIs:

```javascript
try {
    const response = await axios.get(url, config);
    // Process successful response
} catch (error) {
    if (error.response) {
        // API responded with error status
        this.log.error(`API error: ${error.response.status} - ${error.response.data}`);
        
        if (error.response.status === 401) {
            this.log.error('API authentication failed - check API key');
            this.setState('info.connection', false, true);
        } else if (error.response.status === 429) {
            this.log.warn('API rate limit exceeded - will retry later');
        }
    } else if (error.request) {
        // Network error
        this.log.error(`Network error: ${error.message}`);
        this.setState('info.connection', false, true);
    } else {
        // Other error
        this.log.error(`Request error: ${error.message}`);
    }
}
```

### Connection State Management
Always maintain proper connection state indicators:

```javascript
// On successful API connection
this.setState('info.connection', true, true);

// On API errors or timeouts  
this.setState('info.connection', false, true);

// Include connection details in log messages
this.log.info('Connected to API service');
this.log.error('Failed to connect to API service');
```

## ioBroker Adapter Architecture

### Basic Adapter Structure
```javascript
class AdapterName extends utils.Adapter {
    constructor(options = {}) {
        super({
            ...options,
            name: 'adapter-name',
        });
        
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        // Adapter initialization logic
        this.log.info('Adapter started');
        
        // Set connection state
        this.setState('info.connection', false, true);
        
        // Start main functionality
        await this.initialize();
    }

    onStateChange(id, state) {
        if (state && !state.ack) {
            // Handle state changes from user/scripts
            this.log.debug(`State change: ${id} = ${state.val}`);
        }
    }

    onUnload(callback) {
        try {
            // Clear timers/intervals
            if (this.updateTimer) {
                this.clearTimeout(this.updateTimer);
                this.updateTimer = null;
            }
            
            // Close connections
            this.setState('info.connection', false, true);
            
            callback();
        } catch (e) {
            callback();
        }
    }
}
```

### State Object Creation
```javascript
// Create state objects with proper definitions
await this.setObjectNotExistsAsync('summary.energy.today', {
    type: 'state',
    common: {
        name: 'Today\'s energy forecast',
        type: 'number',
        role: 'value.energy',
        read: true,
        write: false,
        unit: 'kWh',
        def: 0
    },
    native: {}
});

// Set state values
await this.setStateAsync('summary.energy.today', {val: energyValue, ack: true});
```

## JSON Config Management

### Admin Configuration
For modern ioBroker adapters, use JSON-Config in `admin/jsonConfig.json`:

```javascript
// Example configuration structure
{
    "type": "panel", 
    "items": {
        "_options": {
            "type": "panel",
            "label": "Options",
            "items": {
                "apiKey": {
                    "type": "text",
                    "label": "API Key",
                    "hidden": "!!data.service && data.service !== 'solcast'",
                    "help": "Required for Solcast service"
                },
                "latitude": {
                    "type": "number",
                    "label": "Latitude", 
                    "min": -90,
                    "max": 90
                },
                "longitude": {
                    "type": "number",
                    "label": "Longitude",
                    "min": -180, 
                    "max": 180
                }
            }
        }
    }
}
```

### Configuration Validation
```javascript
// Validate required configuration
if (!this.config.latitude || !this.config.longitude) {
    this.log.error('Latitude and longitude must be configured');
    return;
}

// Validate API key for certain services
if (this.config.service === 'solcast' && !this.config.apiKey) {
    this.log.error('API key required for Solcast service');
    return;
}
```

## Logging Best Practices

Use appropriate log levels:
- `this.log.error()` - Critical errors that prevent functionality
- `this.log.warn()` - Warnings about potential issues  
- `this.log.info()` - Important status information
- `this.log.debug()` - Detailed debugging information

```javascript
// Good logging examples
this.log.info('Starting PV forecast data collection');
this.log.debug(`API response: ${JSON.stringify(response.data)}`);
this.log.warn('API rate limit approaching, reducing polling frequency');
this.log.error(`Failed to fetch forecast data: ${error.message}`);
```

### Sensitive Data Logging
Never log sensitive information like API keys:

```javascript
// BAD - logs sensitive data
this.log.debug(`Config: ${JSON.stringify(this.config)}`);

// GOOD - masks sensitive data
logSensitive(msg) {
    const protectedKeys = ['apiKey', 'password', 'token'];
    for (const key of protectedKeys) {
        if (this.config[key]) {
            msg = msg.replace(this.config[key], `**config.${key}**`);
        }
    }
    this.log.debug(msg);
}
```

## Code Style and Standards

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

## CI/CD and Testing Integration

### GitHub Actions for API Testing
For adapters with external API dependencies, implement separate CI/CD jobs:

```yaml
# Tests API connectivity with demo credentials (runs separately)
demo-api-tests:
  if: contains(github.event.head_commit.message, '[skip ci]') == false
  
  runs-on: ubuntu-22.04
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run demo API tests
      run: npm run test:integration-demo
```

### CI/CD Best Practices
- Run credential tests separately from main test suite
- Use ubuntu-22.04 for consistency
- Don't make credential tests required for deployment
- Provide clear failure messages for API connectivity issues
- Use appropriate timeouts for external API calls (120+ seconds)

### Package.json Script Integration
Add dedicated script for credential testing:
```json
{
  "scripts": {
    "test:integration-demo": "mocha test/integration-demo --exit"
  }
}
```

### Practical Example: Complete API Testing Implementation
Here's a complete example based on lessons learned from similar adapters:

#### test/integration-demo.js
```javascript
const path = require("path");
const { tests } = require("@iobroker/testing");

// Helper function to encrypt password using ioBroker's encryption method
async function encryptApiKey(harness, apiKey) {
    const systemConfig = await harness.objects.getObjectAsync("system.config");
    
    if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
        throw new Error("Could not retrieve system secret for API key encryption");
    }
    
    const secret = systemConfig.native.secret;
    let result = '';
    for (let i = 0; i < apiKey.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ apiKey.charCodeAt(i));
    }
    
    return result;
}

// Run integration tests with demo credentials
tests.integration(path.join(__dirname, ".."), {
    defineAdditionalTests({ suite }) {
        suite("API Testing with Demo Credentials", (getHarness) => {
            let harness;
            
            before(() => {
                harness = getHarness();
            });

            it("Should connect to API and initialize with demo credentials", async () => {
                console.log("Setting up demo credentials...");
                
                if (harness.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
                
                const encryptedApiKey = await encryptApiKey(harness, "demo_api_key");
                
                await harness.changeAdapterConfig("pvforecast", {
                    native: {
                        service: "solcast",
                        apiKey: encryptedApiKey,
                        latitude: 52.520008,
                        longitude: 13.404954,
                        interval: 60,
                        // other config options
                    }
                });

                console.log("Starting adapter with demo credentials...");
                await harness.startAdapter();
                
                // Wait for API calls and initialization
                await new Promise(resolve => setTimeout(resolve, 60000));
                
                const connectionState = await harness.states.getStateAsync("pvforecast.0.info.connection");
                
                if (connectionState && connectionState.val === true) {
                    console.log("✅ SUCCESS: API connection established");
                    return true;
                } else {
                    throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
                        "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
                }
            }).timeout(120000);
        });
    }
});
```

## Solar Forecast Adapter Specific Guidelines

### Time Series Data Handling
```javascript
// Process hourly forecast data
processHourlyData(forecasts) {
    const hourlyData = {};
    
    forecasts.forEach(forecast => {
        const hour = moment(forecast.time).format('YYYY-MM-DD HH:00:00');
        hourlyData[hour] = {
            power: forecast.pv_estimate, // kW
            energy: forecast.pv_estimate90, // kWh
        };
    });
    
    return hourlyData;
}
```

### Coordinate Validation
```javascript
// Validate geographic coordinates  
validateCoordinates(lat, lon) {
    if (typeof lat !== 'number' || lat < -90 || lat > 90) {
        throw new Error('Latitude must be a number between -90 and 90');
    }
    
    if (typeof lon !== 'number' || lon < -180 || lon > 180) {
        throw new Error('Longitude must be a number between -180 and 180');
    }
}
```

### Energy Unit Conversion
```javascript
// Convert between watts and kilowatts
convertWattsToKW(watts) {
    return Number((watts / 1000).toFixed(3));
}

convertKWToWatts(kw) {
    return Math.round(kw * 1000);
}
```