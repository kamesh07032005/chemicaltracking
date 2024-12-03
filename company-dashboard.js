// Check authentication
const companyData = JSON.parse(sessionStorage.getItem('companyData'));
if (!companyData) {
    window.location.href = 'company-login.html';
}

const API_URL = 'http://localhost:3000';

// Initialize dashboard
async function initializeDashboard() {
    // Set company info in navbar
    document.getElementById('companyName').textContent = companyData.companyName;
    document.getElementById('companyZone').textContent = companyData.zone;

    // Initialize chemical type dropdowns
    const chemicalTypes = companyData.chemicals;
    const chemicalSelects = document.querySelectorAll('select[name="chemicalType"]');
    chemicalSelects.forEach(select => {
        select.innerHTML = '<option value="">Select Chemical</option>' +
            chemicalTypes.map(type => `<option value="${type}">${type}</option>`).join('');
    });

    await updateStats();
    await loadManufacturingHistory();
    await loadSellerCompanies();
    await loadReceivedOrders();
    await loadTransportHistory();
    await loadTrackingData();
}

// Update dashboard statistics
async function updateStats() {
    try {
        const [manufacturing, orders] = await Promise.all([
            fetch(`${API_URL}/manufacturing?companyId=${companyData.id}`).then(res => res.json()),
            fetch(`${API_URL}/orders?sellerId=${companyData.id}&status=pending`).then(res => res.json())
        ]);

        const totalManufactured = manufacturing.reduce((sum, item) => sum + item.quantity, 0);
        const totalSold = manufacturing.reduce((sum, item) => sum + (item.sold || 0), 0);
        
        document.getElementById('totalManufactured').textContent = totalManufactured;
        document.getElementById('currentStock').textContent = totalManufactured - totalSold;
        document.getElementById('activeOrders').textContent = orders.length;
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// Show/hide sections
function showSection(sectionId) {
    document.querySelectorAll('.section-content').forEach(section => {
        section.style.display = 'none';
    });
    document.getElementById(sectionId).style.display = 'block';
    
    // Update active button
    document.querySelectorAll('.list-group-item').forEach(button => {
        button.classList.remove('active');
    });
    event.target.classList.add('active');
}

// Manufacturing form submission
document.getElementById('manufacturingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const manufacturingData = {
        companyId: companyData.id,
        chemicalType: formData.get('chemicalType'),
        quantity: Number(formData.get('quantity')),
        manufacturingDate: formData.get('manufacturingDate'),
        expiryDate: formData.get('expiryDate'),
        manufacturingId: generateId(),
        createdAt: new Date().toISOString(),
        sold: 0
    };

    try {
        const response = await fetch(`${API_URL}/manufacturing`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(manufacturingData)
        });

        if (response.ok) {
            alert('Manufacturing entry added successfully!');
            e.target.reset();
            await updateStats();
            await loadManufacturingHistory();
        } else {
            alert('Error adding manufacturing entry');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error adding manufacturing entry');
    }
});

// Load manufacturing history
async function loadManufacturingHistory() {
    try {
        const response = await fetch(`${API_URL}/manufacturing?companyId=${companyData.id}`);
        const history = await response.json();
        
        const tableBody = document.getElementById('manufacturingHistory');
        tableBody.innerHTML = history.map(item => `
            <tr>
                <td>${item.manufacturingId}</td>
                <td>${item.chemicalType}</td>
                <td>${item.quantity}</td>
                <td>${new Date(item.manufacturingDate).toLocaleString()}</td>
                <td>${new Date(item.expiryDate).toLocaleDateString()}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading manufacturing history:', error);
    }
}

// Load seller companies for purchasing
async function loadSellerCompanies() {
    try {
        const response = await fetch(`${API_URL}/companies`);
        const companies = await response.json();
        
        const sellerSelect = document.querySelector('select[name="sellerCompany"]');
        sellerSelect.innerHTML = '<option value="">Select Company</option>' +
            companies
                .filter(company => 
                    company.id !== companyData.id && 
                    company.activities.includes('Selling'))
                .map(company => `
                    <option value="${company.id}">${company.companyName}</option>
                `).join('');
    } catch (error) {
        console.error('Error loading seller companies:', error);
    }
}

// Purchase form submission
document.getElementById('purchaseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const purchaseData = {
        buyerId: companyData.id,
        buyerName: companyData.companyName,
        sellerId: formData.get('sellerCompany'),
        chemicalType: formData.get('chemicalType'),
        quantity: Number(formData.get('quantity')),
        purpose: formData.get('purpose'),
        deliveryAddress: formData.get('deliveryAddress'),
        status: 'pending',
        orderId: generateId(),
        createdAt: new Date().toISOString()
    };

    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(purchaseData)
        });

        if (response.ok) {
            alert('Purchase order placed successfully!');
            e.target.reset();
        } else {
            alert('Error placing purchase order');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error placing purchase order');
    }
});

// Load received orders
async function loadReceivedOrders() {
    try {
        const response = await fetch(`${API_URL}/orders?sellerId=${companyData.id}&status=pending`);
        const orders = await response.json();
        
        const tableBody = document.getElementById('receivedOrders');
        tableBody.innerHTML = orders.map(order => `
            <tr>
                <td>${order.orderId}</td>
                <td>${order.buyerName}</td>
                <td>${order.chemicalType}</td>
                <td>${order.quantity}</td>
                <td>
                    <button class="btn btn-success btn-sm" onclick="processOrder('${order.id}', 'accept')">Accept</button>
                    <button class="btn btn-danger btn-sm" onclick="processOrder('${order.id}', 'reject')">Reject</button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading received orders:', error);
    }
}

// Process order (accept/reject)
async function processOrder(orderId, action) {
    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: action === 'accept' ? 'accepted' : 'rejected',
                processedAt: new Date().toISOString()
            })
        });

        if (response.ok) {
            alert(`Order ${action}ed successfully!`);
            await loadReceivedOrders();
            if (action === 'accept') {
                await updateAcceptedOrders();
            }
        } else {
            alert(`Error ${action}ing order`);
        }
    } catch (error) {
        console.error('Error:', error);
        alert(`Error ${action}ing order`);
    }
}

// Update accepted orders in transport section
async function updateAcceptedOrders() {
    try {
        const response = await fetch(`${API_URL}/orders?sellerId=${companyData.id}&status=accepted`);
        const orders = await response.json();
        
        const container = document.getElementById('acceptedOrders');
        container.innerHTML = orders.map(order => `
            <div class="card mb-3">
                <div class="card-body">
                    <h6>Order ID: ${order.orderId}</h6>
                    <p>Buyer: ${order.buyerName}</p>
                    <p>Chemical: ${order.chemicalType}</p>
                    <p>Quantity: ${order.quantity}</p>
                    <p>Delivery Address: ${order.deliveryAddress}</p>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error updating accepted orders:', error);
    }
}

// Transport form submission
document.getElementById('transportForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const transportData = {
        companyId: companyData.id,
        companyName: companyData.companyName,
        zone: companyData.zone,
        vehicleNumber: formData.get('vehicleNumber'),
        driverName: formData.get('driverName'),
        transferTime: formData.get('transferTime'),
        transportId: generateId(),
        status: 'in-transit',
        currentLocation: 'Starting point',
        tamperStatus: 'OK',
        createdAt: new Date().toISOString()
    };

    try {
        const response = await fetch(`${API_URL}/transport`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(transportData)
        });

        if (response.ok) {
            alert('Transport initiated successfully!');
            e.target.reset();
            await loadTransportHistory();
        } else {
            alert('Error initiating transport');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error initiating transport');
    }
});

// Load transport history
async function loadTransportHistory() {
    try {
        const response = await fetch(`${API_URL}/transport?companyId=${companyData.id}`);
        const history = await response.json();
        
        const tableBody = document.getElementById('transportHistory');
        tableBody.innerHTML = history.map(item => `
            <tr>
                <td>${item.transportId}</td>
                <td>${item.companyName}</td>
                <td>${item.vehicleNumber} (${item.driverName})</td>
                <td>${new Date(item.transferTime).toLocaleString()}</td>
                <td>${item.status}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading transport history:', error);
    }
}

// Load tracking data
async function loadTrackingData() {
    try {
        const response = await fetch(`${API_URL}/transport?status=in-transit`);
        const shipments = await response.json();
        
        const tableBody = document.getElementById('trackingData');
        tableBody.innerHTML = shipments
            .filter(item => item.companyId === companyData.id)
            .map(item => `
                <tr>
                    <td>${item.transportId}</td>
                    <td>${item.fromCompany} → ${item.toCompany}</td>
                    <td>${item.vehicleNumber} (${item.driverName})</td>
                    <td>${item.currentLocation}</td>
                    <td>
                        ${item.status}
                        ${item.tamperStatus !== 'OK' ? 
                            '<span class="badge bg-danger">Tampered</span>' : 
                            '<span class="badge bg-success">OK</span>'}
                    </td>
                </tr>
            `).join('');
    } catch (error) {
        console.error('Error loading tracking data:', error);
    }
}

// Helper function to generate unique IDs
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Logout function
function logout() {
    sessionStorage.removeItem('companyData');
    window.location.href = 'company-login.html';
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', initializeDashboard);
