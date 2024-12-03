// GPS Location Tracking
function initializeGPSTracking(transportId, vehicleNumber) {
    if ("geolocation" in navigator) {
        const watchId = navigator.geolocation.watchPosition(
            async position => {
                const locationData = {
                    transportId,
                    vehicleNumber,
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    timestamp: new Date().toISOString(),
                    accuracy: position.coords.accuracy
                };

                try {
                    await updateTransportLocation(locationData);
                } catch (error) {
                    console.error('Error updating location:', error);
                }
            },
            error => {
                console.error('GPS Error:', error);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 30000,
                timeout: 27000
            }
        );
        return watchId;
    }
    return null;
}

// Update transport location
async function updateTransportLocation(locationData) {
    try {
        const response = await fetch(`${API_URL}/transport/${locationData.transportId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                currentLocation: `${locationData.latitude},${locationData.longitude}`,
                lastUpdate: locationData.timestamp
            })
        });
        return response.ok;
    } catch (error) {
        console.error('Error:', error);
        return false;
    }
}

// Generate chemical batch ID
function generateBatchId(companyId, chemicalType) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${companyId}-${chemicalType.substr(0, 3).toUpperCase()}-${timestamp}-${random}`;
}

// Check for tamper alerts
async function checkTamperStatus(transportId, expectedRoute) {
    try {
        const response = await fetch(`${API_URL}/transport/${transportId}`);
        const transportData = await response.json();
        
        const currentLocation = transportData.currentLocation.split(',').map(Number);
        const isOnRoute = checkIfOnRoute(currentLocation, expectedRoute);
        
        if (!isOnRoute) {
            await createTamperAlert(transportId, 'ROUTE_DEVIATION');
        }
        
        return isOnRoute;
    } catch (error) {
        console.error('Error checking tamper status:', error);
        return false;
    }
}

// Create tamper alert
async function createTamperAlert(transportId, alertType) {
    try {
        const transportResponse = await fetch(`${API_URL}/transport/${transportId}`);
        const transportData = await transportResponse.json();
        
        const alertData = {
            transportId,
            type: alertType,
            zone: transportData.zone,
            timestamp: new Date().toISOString(),
            status: 'ACTIVE',
            details: {
                vehicleNumber: transportData.vehicleNumber,
                currentLocation: transportData.currentLocation,
                lastUpdate: transportData.lastUpdate
            }
        };
        
        await fetch(`${API_URL}/alerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alertData)
        });
        
        // Update transport status
        await fetch(`${API_URL}/transport/${transportId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                tamperStatus: 'ALERT',
                alertType: alertType
            })
        });
    } catch (error) {
        console.error('Error creating tamper alert:', error);
    }
}

// Analytics functions
async function generateAnalytics() {
    try {
        const [companies, manufacturing, orders, transport, alerts] = await Promise.all([
            fetch(`${API_URL}/companies`).then(res => res.json()),
            fetch(`${API_URL}/manufacturing`).then(res => res.json()),
            fetch(`${API_URL}/orders`).then(res => res.json()),
            fetch(`${API_URL}/transport`).then(res => res.json()),
            fetch(`${API_URL}/alerts`).then(res => res.json())
        ]);

        return {
            companyStats: analyzeCompanies(companies),
            manufacturingStats: analyzeManufacturing(manufacturing),
            orderStats: analyzeOrders(orders),
            transportStats: analyzeTransport(transport),
            alertStats: analyzeAlerts(alerts),
            zoneWiseAnalysis: analyzeZones(companies, transport, alerts)
        };
    } catch (error) {
        console.error('Error generating analytics:', error);
        return null;
    }
}

// Helper functions for analytics
function analyzeCompanies(companies) {
    const zoneWise = companies.reduce((acc, company) => {
        acc[company.zone] = (acc[company.zone] || 0) + 1;
        return acc;
    }, {});

    const chemicalTypes = companies.reduce((acc, company) => {
        company.chemicals.forEach(chemical => {
            acc[chemical] = (acc[chemical] || 0) + 1;
        });
        return acc;
    }, {});

    return { zoneWise, chemicalTypes };
}

function analyzeManufacturing(manufacturing) {
    return manufacturing.reduce((acc, item) => {
        acc.totalQuantity = (acc.totalQuantity || 0) + item.quantity;
        acc.byChemical = acc.byChemical || {};
        acc.byChemical[item.chemicalType] = (acc.byChemical[item.chemicalType] || 0) + item.quantity;
        return acc;
    }, {});
}

function analyzeOrders(orders) {
    return orders.reduce((acc, order) => {
        acc.total = (acc.total || 0) + 1;
        acc.byStatus = acc.byStatus || {};
        acc.byStatus[order.status] = (acc.byStatus[order.status] || 0) + 1;
        return acc;
    }, {});
}

function analyzeTransport(transport) {
    return transport.reduce((acc, item) => {
        acc.total = (acc.total || 0) + 1;
        acc.byStatus = acc.byStatus || {};
        acc.byStatus[item.status] = (acc.byStatus[item.status] || 0) + 1;
        acc.byZone = acc.byZone || {};
        acc.byZone[item.zone] = (acc.byZone[item.zone] || 0) + 1;
        return acc;
    }, {});
}

function analyzeAlerts(alerts) {
    return alerts.reduce((acc, alert) => {
        acc.total = (acc.total || 0) + 1;
        acc.byType = acc.byType || {};
        acc.byType[alert.type] = (acc.byType[alert.type] || 0) + 1;
        acc.byZone = acc.byZone || {};
        acc.byZone[alert.zone] = (acc.byZone[alert.zone] || 0) + 1;
        return acc;
    }, {});
}

function analyzeZones(companies, transport, alerts) {
    const zones = ['North Zone', 'South Zone', 'East Zone', 'West Zone'];
    return zones.reduce((acc, zone) => {
        acc[zone] = {
            companies: companies.filter(c => c.zone === zone).length,
            activeTransport: transport.filter(t => t.zone === zone && t.status === 'in-transit').length,
            alerts: alerts.filter(a => a.zone === zone && a.status === 'ACTIVE').length
        };
        return acc;
    }, {});
}

// Emergency alert system
async function createEmergencyAlert(data) {
    try {
        const alertData = {
            ...data,
            timestamp: new Date().toISOString(),
            status: 'EMERGENCY',
            priority: 'HIGH'
        };

        const response = await fetch(`${API_URL}/alerts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alertData)
        });

        if (response.ok) {
            // Send notifications to relevant authorities
            await notifyAuthorities(alertData);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error creating emergency alert:', error);
        return false;
    }
}

// Notify authorities
async function notifyAuthorities(alertData) {
    // In a real implementation, this would integrate with various notification systems
    console.log('Emergency Alert:', alertData);
    // TODO: Implement actual notification system (SMS, Email, etc.)
}

// Export utilities
export {
    initializeGPSTracking,
    updateTransportLocation,
    generateBatchId,
    checkTamperStatus,
    createTamperAlert,
    generateAnalytics,
    createEmergencyAlert
};
