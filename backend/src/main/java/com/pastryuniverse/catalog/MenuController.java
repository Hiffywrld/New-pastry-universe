package com.pastryuniverse.catalog;

import java.util.concurrent.TimeUnit;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/menu")
public class MenuController {

    private final MenuService menu;

    public MenuController(MenuService menu) {
        this.menu = menu;
    }

    @GetMapping
    public ResponseEntity<MenuView> get() {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(30, TimeUnit.SECONDS).cachePublic()).body(menu.menu());
    }
}
