package com.pastryuniverse.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String slug;
    private String name;
    private String category;
    private String tag;

    @Column(columnDefinition = "text")
    private String description;

    private int sortOrder;
    private boolean active = true;

    @OneToMany(mappedBy = "product")
    @OrderBy("sizeSort ASC, optionSort ASC")
    private List<Variant> variants = new ArrayList<>();

    public Long getId() { return id; }
    public String getSlug() { return slug; }
    public String getName() { return name; }
    public String getCategory() { return category; }
    public String getTag() { return tag; }
    public String getDescription() { return description; }
    public int getSortOrder() { return sortOrder; }
    public boolean isActive() { return active; }
    public List<Variant> getVariants() { return variants; }
}
