package com.flashticket.core.event.client;

import com.flashticket.core.event.dto.OrganizerDTO;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.service.annotation.GetExchange;
import org.springframework.web.service.annotation.HttpExchange;


@HttpExchange
public interface UserServiceClient {

    @GetExchange("/api/organizers/{organizerId}")
    OrganizerDTO getOrganizerProfile(@PathVariable String organizerId);
}

