const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

let landlordToken = '';
let tenantToken = '';
let propertyId = null;

// Helper function to log section headers
function logSection(title) {
    console.log(`\n${colors.cyan}${'='.repeat(60)}`);
    console.log(`${title}`);
    console.log(`${'='.repeat(60)}${colors.reset}\n`);
}

// Helper function to log success
function logSuccess(message) {
    console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

// Helper function to log error
function logError(message, error) {
    console.log(`${colors.red}✗ ${message}`);
    if (error.response) {
        console.log(`  Status: ${error.response.status}`);
        console.log(`  Error: ${JSON.stringify(error.response.data, null, 2)}`);
    } else {
        console.log(`  Error: ${error.message}`);
    }
    console.log(colors.reset);
}

// Helper function to log data
function logData(data) {
    console.log(JSON.stringify(data, null, 2));
}

// 1. Register Landlord
async function registerLandlord() {
    logSection('1. Register Landlord');
    try {
        const response = await axios.post(`${BASE_URL}/auth/register`, {
            username: `landlord_${Date.now()}`,
            email: `landlord${Date.now()}@test.com`,
            password: 'password123',
            role: 'landlord',
            first_name: 'John',
            last_name: 'Smith',
            phone: '+1234567890'
        });
        
        landlordToken = response.data.data.token;
        logSuccess('Landlord registered successfully');
        console.log(`User ID: ${response.data.data.user.id}`);
        console.log(`Email: ${response.data.data.user.email}`);
        console.log(`Token: ${landlordToken.substring(0, 20)}...`);
        return response.data.data.user;
    } catch (error) {
        logError('Failed to register landlord', error);
        throw error;
    }
}

// 2. Register Tenant
async function registerTenant() {
    logSection('2. Register Tenant');
    try {
        const response = await axios.post(`${BASE_URL}/auth/register`, {
            username: `tenant_${Date.now()}`,
            email: `tenant${Date.now()}@test.com`,
            password: 'password123',
            role: 'tenant',
            first_name: 'Jane',
            last_name: 'Doe',
            phone: '+1987654321'
        });
        
        tenantToken = response.data.data.token;
        logSuccess('Tenant registered successfully');
        console.log(`User ID: ${response.data.data.user.id}`);
        console.log(`Email: ${response.data.data.user.email}`);
        console.log(`Token: ${tenantToken.substring(0, 20)}...`);
        return response.data.data.user;
    } catch (error) {
        logError('Failed to register tenant', error);
        throw error;
    }
}

// 3. Create Property (Landlord)
async function createProperty() {
    logSection('3. Create Property (Landlord)');
    try {
        const response = await axios.post(`${BASE_URL}/properties`, {
            title: 'Modern Downtown Apartment',
            description: 'Beautiful 2-bedroom apartment with city views, recently renovated with modern amenities.',
            address: '123 Main Street, Apt 4B',
            city: 'New York',
            state: 'NY',
            zip_code: '10001',
            property_type: 'apartment',
            bedrooms: 2,
            bathrooms: 1.5,
            square_feet: 1200,
            rent_amount: 2500,
            security_deposit: 2500,
            utilities_included: false,
            pet_friendly: true,
            parking_available: true,
            amenities: ['gym', 'pool', 'parking', 'laundry', '24-hour security']
        }, {
            headers: { Authorization: `Bearer ${landlordToken}` }
        });
        
        propertyId = response.data.propertyId;
        logSuccess(`Property created successfully with ID: ${propertyId}`);
        return propertyId;
    } catch (error) {
        logError('Failed to create property', error);
        throw error;
    }
}

// 4. Get All Properties (Both Users)
async function getAllProperties(token, userRole) {
    logSection(`4. Get All Properties (${userRole})`);
    try {
        const response = await axios.get(`${BASE_URL}/properties`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        logSuccess(`Found ${response.data.length} properties`);
        if (response.data.length > 0) {
            console.log(`\nFirst property details:`);
            logData(response.data[0]);
        }
        return response.data;
    } catch (error) {
        logError('Failed to get properties', error);
        throw error;
    }
}

// 5. Get Property by ID
async function getPropertyById(id, token, userRole) {
    logSection(`5. Get Property by ID (${userRole})`);
    try {
        const response = await axios.get(`${BASE_URL}/properties/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        logSuccess(`Property details retrieved successfully`);
        logData(response.data);
        return response.data;
    } catch (error) {
        logError('Failed to get property by ID', error);
        throw error;
    }
}

// 6. Update Property (Landlord)
async function updateProperty(id) {
    logSection('6. Update Property (Landlord)');
    try {
        const response = await axios.put(`${BASE_URL}/properties/${id}`, {
            rent_amount: 2600,
            description: 'Beautiful 2-bedroom apartment with city views, recently renovated with modern amenities. PRICE UPDATED!',
            status: 'available'
        }, {
            headers: { Authorization: `Bearer ${landlordToken}` }
        });
        
        logSuccess('Property updated successfully');
        logData(response.data);
        return response.data;
    } catch (error) {
        logError('Failed to update property', error);
        throw error;
    }
}

// 7. Get Properties with Filters
async function getPropertiesWithFilters() {
    logSection('7. Get Properties with Filters');
    
    // Test various filters
    const filters = [
        { city: 'New York' },
        { property_type: 'apartment' },
        { min_rent: 2000, max_rent: 3000 },
        { status: 'available' }
    ];
    
    for (const filter of filters) {
        try {
            const params = new URLSearchParams(filter).toString();
            const response = await axios.get(`${BASE_URL}/properties?${params}`, {
                headers: { Authorization: `Bearer ${landlordToken}` }
            });
            
            logSuccess(`Filter ${JSON.stringify(filter)} - Found ${response.data.length} properties`);
        } catch (error) {
            logError(`Failed to get properties with filter ${JSON.stringify(filter)}`, error);
        }
    }
}

// 8. Get Properties by Landlord
async function getPropertiesByLandlord(landlordId) {
    logSection('8. Get Properties by Landlord');
    try {
        const response = await axios.get(`${BASE_URL}/properties/landlord/${landlordId}`, {
            headers: { Authorization: `Bearer ${landlordToken}` }
        });
        
        logSuccess(`Found ${response.data.length} properties for landlord`);
        if (response.data.length > 0) {
            console.log(`\nProperties list:`);
            response.data.forEach((prop, index) => {
                console.log(`${index + 1}. ${prop.title} - $${prop.rent_amount}/month`);
            });
        }
        return response.data;
    } catch (error) {
        logError('Failed to get properties by landlord', error);
        throw error;
    }
}

// 9. Test Tenant Cannot Create Property
async function testTenantCannotCreate() {
    logSection('9. Test Tenant Cannot Create Property (Security Check)');
    try {
        await axios.post(`${BASE_URL}/properties`, {
            title: 'Unauthorized Property',
            address: '456 Fake St',
            city: 'Boston',
            property_type: 'house',
            rent_amount: 3000
        }, {
            headers: { Authorization: `Bearer ${tenantToken}` }
        });
        
        logError('SECURITY ISSUE: Tenant was able to create property!', new Error('Security check failed'));
    } catch (error) {
        if (error.response && error.response.status === 403) {
            logSuccess('Security check passed: Tenant correctly denied property creation');
        } else {
            logError('Unexpected error during security check', error);
        }
    }
}

// 10. Test Tenant Cannot Update Property
async function testTenantCannotUpdate(id) {
    logSection('10. Test Tenant Cannot Update Property (Security Check)');
    try {
        await axios.put(`${BASE_URL}/properties/${id}`, {
            rent_amount: 1000
        }, {
            headers: { Authorization: `Bearer ${tenantToken}` }
        });
        
        logError('SECURITY ISSUE: Tenant was able to update property!', new Error('Security check failed'));
    } catch (error) {
        if (error.response && error.response.status === 403) {
            logSuccess('Security check passed: Tenant correctly denied property update');
        } else {
            logError('Unexpected error during security check', error);
        }
    }
}

// 11. Test Tenant Cannot Delete Property
async function testTenantCannotDelete(id) {
    logSection('11. Test Tenant Cannot Delete Property (Security Check)');
    try {
        await axios.delete(`${BASE_URL}/properties/${id}`, {
            headers: { Authorization: `Bearer ${tenantToken}` }
        });
        
        logError('SECURITY ISSUE: Tenant was able to delete property!', new Error('Security check failed'));
    } catch (error) {
        if (error.response && error.response.status === 403) {
            logSuccess('Security check passed: Tenant correctly denied property deletion');
        } else {
            logError('Unexpected error during security check', error);
        }
    }
}

// 12. Create Multiple Properties
async function createMultipleProperties() {
    logSection('12. Create Multiple Properties');
    
    const properties = [
        {
            title: 'Luxury Penthouse',
            address: '789 High Street, PH',
            city: 'New York',
            state: 'NY',
            zip_code: '10002',
            property_type: 'apartment',
            bedrooms: 3,
            bathrooms: 2.5,
            square_feet: 2000,
            rent_amount: 5000,
            security_deposit: 5000,
            amenities: ['gym', 'pool', 'doorman', 'roof deck']
        },
        {
            title: 'Cozy Studio',
            address: '321 Small Ave',
            city: 'Brooklyn',
            state: 'NY',
            zip_code: '11201',
            property_type: 'studio',
            bedrooms: 0,
            bathrooms: 1,
            square_feet: 500,
            rent_amount: 1500,
            security_deposit: 1500,
            amenities: ['laundry']
        },
        {
            title: 'Suburban House',
            address: '555 Oak Lane',
            city: 'Queens',
            state: 'NY',
            zip_code: '11354',
            property_type: 'house',
            bedrooms: 4,
            bathrooms: 3,
            square_feet: 2500,
            rent_amount: 4000,
            security_deposit: 4000,
            pet_friendly: true,
            parking_available: true,
            amenities: ['garage', 'backyard', 'fireplace']
        }
    ];
    
    const createdIds = [];
    for (const property of properties) {
        try {
            const response = await axios.post(`${BASE_URL}/properties`, property, {
                headers: { Authorization: `Bearer ${landlordToken}` }
            });
            createdIds.push(response.data.propertyId);
            logSuccess(`Created: ${property.title} (ID: ${response.data.propertyId})`);
        } catch (error) {
            logError(`Failed to create ${property.title}`, error);
        }
    }
    
    return createdIds;
}

// 13. Test Invalid Data
async function testInvalidData() {
    logSection('13. Test Invalid Data (Validation)');
    
    // Missing required fields
    try {
        await axios.post(`${BASE_URL}/properties`, {
            description: 'Missing required fields'
        }, {
            headers: { Authorization: `Bearer ${landlordToken}` }
        });
        logError('VALIDATION ISSUE: Property created with missing required fields!', new Error('Validation check failed'));
    } catch (error) {
        if (error.response && error.response.status === 400) {
            logSuccess('Validation check passed: Missing required fields correctly rejected');
        } else {
            logError('Unexpected error during validation check', error);
        }
    }
}

// 14. Delete Property (Landlord)
async function deleteProperty(id) {
    logSection('14. Delete Property (Landlord)');
    try {
        const response = await axios.delete(`${BASE_URL}/properties/${id}`, {
            headers: { Authorization: `Bearer ${landlordToken}` }
        });
        
        logSuccess(`Property ${id} deleted successfully`);
        logData(response.data);
        return response.data;
    } catch (error) {
        logError('Failed to delete property', error);
        throw error;
    }
}

// Main test runner
async function runTests() {
    console.log(`${colors.blue}
╔═══════════════════════════════════════════════════════════╗
║          SmartRent Properties API Test Suite             ║
║                  Testing All Endpoints                    ║
╚═══════════════════════════════════════════════════════════╝
${colors.reset}`);
    
    try {
        // Setup: Register users
        const landlord = await registerLandlord();
        const tenant = await registerTenant();
        
        // Test basic CRUD operations
        await createProperty();
        await getAllProperties(landlordToken, 'Landlord');
        await getAllProperties(tenantToken, 'Tenant');
        await getPropertyById(propertyId, landlordToken, 'Landlord');
        await getPropertyById(propertyId, tenantToken, 'Tenant');
        await updateProperty(propertyId);
        
        // Test filters
        await getPropertiesWithFilters();
        await getPropertiesByLandlord(landlord.id);
        
        // Security tests
        await testTenantCannotCreate();
        await testTenantCannotUpdate(propertyId);
        await testTenantCannotDelete(propertyId);
        
        // Create multiple properties
        await createMultipleProperties();
        
        // Validation tests
        await testInvalidData();
        
        // Get all properties again to see the full list
        const allProperties = await getAllProperties(landlordToken, 'Landlord');
        
        // Cleanup: Delete the first property (optional)
        // await deleteProperty(propertyId);
        
        // Summary
        logSection('Test Summary');
        console.log(`${colors.green}✓ All tests completed successfully!${colors.reset}`);
        console.log(`${colors.cyan}Total properties in system: ${allProperties.length}${colors.reset}`);
        console.log(`\n${colors.yellow}Note: Properties are NOT deleted for manual inspection.${colors.reset}`);
        console.log(`${colors.yellow}You can view them in the database or via API calls.${colors.reset}\n`);
        
    } catch (error) {
        console.error(`${colors.red}\n✗ Test suite failed!${colors.reset}`);
        console.error(error.message);
        process.exit(1);
    }
}

// Check if server is running
async function checkServer() {
    try {
        await axios.get(`${BASE_URL}/auth/me`, {
            headers: { Authorization: 'Bearer invalid' }
        });
    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.error(`${colors.red}✗ Cannot connect to server at ${BASE_URL}`);
            console.error(`Please make sure the backend server is running on port 5000${colors.reset}`);
            process.exit(1);
        }
    }
}

// Run the tests
(async () => {
    await checkServer();
    await runTests();
})();
