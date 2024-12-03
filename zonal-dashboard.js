// Check authentication
const officerData = JSON.parse(sessionStorage.getItem('zonalOfficer'));
if (!officerData) {
    window.location.href = 'zonal-login.html';
}

const API_URL = 'http://localhost:3000';

// Initialize dashboard
async function initializeDashboard() {
    // Set officer info in navbar
    document.getElementById('officerName').textContent = officerData.officerName;
    document.getElementById('officerZone').textContent = officerData.zone;

    await updateStats();
    await loadTransportDetails();
}

// Update dashboard statistics
async function updateStats() {
    try {
        const [transports, companies, alerts] = await Promise.all([
            fetch(`${API_URL}/transport?status=in-transit`).then(res => res.json()),
            fetch(`${API_URL}/companies`).then(res => res.json()),
            fetch(`${API_URL}/alerts?status=active`).then(res => res.json())
        ]);

        const zoneTransports = transports.filter(t => t.zone === officerData.zone);
        const zoneCompanies = companies.filter(c => c.zone === officerData.zone);
        const zoneAlerts = alerts.filter(a => a.zone === officerData.zone);

        document.getElementById('activeTransports').textContent = zoneTransports.length;
        document.getElementById('zoneCompanies').textContent = zoneCompanies.length;
        document.getElementById('activeAlerts').textContent = zoneAlerts.length;
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

// Load transport details
async function loadTransportDetails() {
    try {
        const response = await fetch(`${API_URL}/transport`);
        const transports = await response.json();
        
        const tableBody = document.getElementById('transportDetails');
        tableBody.innerHTML = transports
            .filter(transport => transport.zone === officerData.zone)
            .map(transport => `
                <tr>
                    <td>${transport.transportId}</td>
                    <td>${transport.fromCompany}</td>
                    <td>${transport.toCompany}</td>
                    <td>${transport.chemicalType}</td>
                    <td>${transport.vehicleNumber} (${transport.driverName})</td>
                    <td>
                        ${transport.status}
                        ${transport.tamperStatus !== 'OK' ? 
                            '<span class="badge bg-danger">Tampered</span>' : 
                            '<span class="badge bg-success">OK</span>'}
                    </td>
                    <td>
                        <button class="btn btn-warning btn-sm" onclick="showReportModal('${transport.transportId}')">
                            Report
                        </button>
                    </td>
                </tr>
            `).join('');
    } catch (error) {
        console.error('Error loading transport details:', error);
    }
}

// Show report modal
function showReportModal(transportId) {
    document.getElementById('transportId').value = transportId;
    const modal = new bootstrap.Modal(document.getElementById('reportModal'));
    modal.show();
}

// Submit report
async function submitReport() {
    const transportId = document.getElementById('transportId').value;
    const reportType = document.getElementById('reportType').value;
    const description = document.getElementById('reportDescription').value;

    const reportData = {
        transportId,
        reportType,
        description,
        officerId: officerData.officerId,
        officerName: officerData.officerName,
        zone: officerData.zone,
        status: 'pending',
        createdAt: new Date().toISOString()
    };

    try {
        const response = await fetch(`${API_URL}/reports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportData)
        });

        if (response.ok) {
            alert('Report submitted successfully!');
            bootstrap.Modal.getInstance(document.getElementById('reportModal')).hide();
            document.getElementById('reportForm').reset();
        } else {
            alert('Error submitting report');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error submitting report');
    }
}

// Logout function
function logout() {
    sessionStorage.removeItem('zonalOfficer');
    window.location.href = 'zonal-login.html';
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', initializeDashboard);
