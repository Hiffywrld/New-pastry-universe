package com.pastryuniverse.catalog;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Something a customer can actually buy: one size of a product with one option. */
@Entity
@Table(name = "variants")
public class Variant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id")
    private Product product;

    private String sizeKey;
    private String sizeLabel;
    private int sizeSort;
    private String optionLabel;
    private int optionSort;
    private int price;
    private boolean available = true;
    private boolean active = true;

    public Long getId() { return id; }
    public Product getProduct() { return product; }
    public String getSizeKey() { return sizeKey; }
    public String getSizeLabel() { return sizeLabel; }
    public int getSizeSort() { return sizeSort; }
    public String getOptionLabel() { return optionLabel; }
    public int getOptionSort() { return optionSort; }
    public int getPrice() { return price; }
    public boolean isAvailable() { return available; }
    public boolean isActive() { return active; }

    public boolean isBuyable() {
        return active && available && product.isActive();
    }
}
