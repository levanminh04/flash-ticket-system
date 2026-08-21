package com.flashticket.mobile.app.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class NavigationRoutesUnitTest {

    @Test
    fun typeSafeRoutes_areInstantiableAndNotNull() {
        assertNotNull(LoginRoute)
        assertNotNull(G0PocRoute)
        assertNotNull(BuyerDiscoveryRoute)
        assertNotNull(BuyerTicketsRoute)
        assertNotNull(BuyerProfileRoute)
        assertNotNull(OrganizerScannerRoute)
        assertNotNull(OrganizerEventsRoute)
        assertNotNull(OrganizerProfileRoute)
        assertNotNull(AdminOrganizersReviewRoute)
        assertNotNull(AdminDashboardRoute)
        assertNotNull(AdminProfileRoute)
    }

    @Test
    fun topLevelGraphs_areDefinedCorrectly() {
        assertNotNull(AuthGraph)
        assertNotNull(GuestGraph)
        assertNotNull(BuyerGraph)
        assertNotNull(OrganizerGraph)
        assertNotNull(AdminGraph)
    }

    @Test
    fun buyerBottomNavItems_containsExpectedTabs() {
        assertEquals(3, BuyerBottomNavItems.size)
        assertEquals(BuyerDiscoveryRoute, BuyerBottomNavItems[0].route)
        assertEquals(BuyerTicketsRoute, BuyerBottomNavItems[1].route)
        assertEquals(BuyerProfileRoute, BuyerBottomNavItems[2].route)
    }

    @Test
    fun organizerBottomNavItems_containsExpectedTabs() {
        assertEquals(3, OrganizerBottomNavItems.size)
        assertEquals(OrganizerScannerRoute, OrganizerBottomNavItems[0].route)
        assertEquals(OrganizerEventsRoute, OrganizerBottomNavItems[1].route)
        assertEquals(OrganizerProfileRoute, OrganizerBottomNavItems[2].route)
    }

    @Test
    fun adminBottomNavItems_containsExpectedTabs() {
        assertEquals(3, AdminBottomNavItems.size)
        assertEquals(AdminOrganizersReviewRoute, AdminBottomNavItems[0].route)
        assertEquals(AdminDashboardRoute, AdminBottomNavItems[1].route)
        assertEquals(AdminProfileRoute, AdminBottomNavItems[2].route)
    }
}
