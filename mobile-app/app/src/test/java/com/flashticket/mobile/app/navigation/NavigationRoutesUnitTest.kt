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
        assertNotNull(OrganizerDashboardRoute)
        assertNotNull(AdminDashboardRoute)
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
}
