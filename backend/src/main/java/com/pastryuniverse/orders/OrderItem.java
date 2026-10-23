package com.pastryuniverse.orders;

import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "order_items")
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id")
    private Order order;

    private Long variantId;
    private Long productId;
    private String productSlug;
    private String productName;
    private String sizeLabel;
    private String optionLabel;
    private int unitPrice;
    private int quantity;
    private int lineTotal;

    protected OrderItem() {}

    public OrderItem(Order order, Long variantId, Long productId, String productSlug, String productName,
                     String sizeLabel, String optionLabel, int unitPrice, int quantity) {
        this.order = order;
        this.variantId = variantId;
        this.productId = productId;
        this.productSlug = productSlug;
        this.productName = productName;
        this.sizeLabel = sizeLabel;
        this.optionLabel = optionLabel == null ? "" : optionLabel;
        this.unitPrice = unitPrice;
        this.quantity = quantity;
        this.lineTotal = unitPrice * quantity;
    }

    public Long getVariantId() { return variantId; }
    public String getProductSlug() { return productSlug; }
    public String getProductName() { return productName; }
    public String getSizeLabel() { return sizeLabel; }
    public String getOptionLabel() { return optionLabel; }
    public int getUnitPrice() { return unitPrice; }
    public int getQuantity() { return quantity; }
    public int getLineTotal() { return lineTotal; }

    /** "Banana Bread (Medium, Raisins)" */
    public String describe() {
        StringBuilder sb = new StringBuilder(productName);
        boolean hasSize = sizeLabel != null && !sizeLabel.isBlank() && !"Regular".equals(sizeLabel);
        boolean hasOption = optionLabel != null && !optionLabel.isBlank();
        if (hasSize || hasOption) {
            sb.append(" (");
            if (hasSize) sb.append(sizeLabel);
            if (hasSize && hasOption) sb.append(", ");
            if (hasOption) sb.append(optionLabel);
            sb.append(")");
        }
        return sb.toString();
    }
}
