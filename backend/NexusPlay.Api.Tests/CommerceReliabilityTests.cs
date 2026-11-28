using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using NexusPlay.Api.Controllers;
using NexusPlay.Api.Dtos;
using NexusPlay.Api.Services;
using NexusPlay.Core.Interfaces;
using NexusPlay.Core.Models;

namespace NexusPlay.Api.Tests;

public class CommerceReliabilityTests
{
    [Fact]
    public async Task ReplayingTheSameKeyReturnsTheOriginalOrderAndSendsOneNotification()
    {
        var (controller, orders, sms) = CreateController();
        SetIdempotencyKey(controller, "5c7d80c0-b313-4faf-9b9f-6d7100f72001");

        var first = await controller.Place(CreateRequest(), CancellationToken.None);
        var replay = await controller.Place(CreateRequest(), CancellationToken.None);

        var firstOrder = Assert.IsType<Order>(Assert.IsType<CreatedAtActionResult>(first.Result).Value);
        var replayOrder = Assert.IsType<Order>(Assert.IsType<CreatedAtActionResult>(replay.Result).Value);
        Assert.Equal(firstOrder.OrderNo, replayOrder.OrderNo);
        orders.Verify(repo => repo.CreateOrGetAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
        sms.Verify(service => service.SendAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ReusingKeyForDifferentOrderReturnsConflict()
    {
        var (controller, _, _) = CreateController();
        SetIdempotencyKey(controller, "5c7d80c0-b313-4faf-9b9f-6d7100f72002");

        await controller.Place(CreateRequest(), CancellationToken.None);
        var changedRequest = CreateRequest() with
        {
            Customer = new CustomerDto("Different Customer", "01712345678", null, "House 2", null, null, null),
        };
        var replay = await controller.Place(changedRequest, CancellationToken.None);

        Assert.IsType<ConflictObjectResult>(replay.Result);
    }

    [Fact]
    public async Task RejectsMalformedIdempotencyKeyBeforeCreatingOrder()
    {
        var (controller, orders, _) = CreateController();
        SetIdempotencyKey(controller, "short");

        var result = await controller.Place(CreateRequest(), CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        orders.Verify(repo => repo.CreateOrGetAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()), Times.Never);
        orders.Verify(repo => repo.CreateAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task MyOrdersQueryIsScopedToAuthenticatedUserBeforePagination()
    {
        var (controller, orders, _) = CreateController();
        controller.HttpContext.User = new System.Security.Claims.ClaimsPrincipal(
            new System.Security.Claims.ClaimsIdentity(
                [new System.Security.Claims.Claim("sub", "user-1")],
                "test"));
        orders.Setup(repo => repo.SearchAsync(It.IsAny<OrderQuery>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new PagedResult<Order>());

        var result = await controller.My(2, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
        orders.Verify(repo => repo.SearchAsync(
            It.Is<OrderQuery>(query => query.UserId == "user-1" && query.Page == 2 && query.PageSize == 20),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PublicTrackingRejectsPartialPhoneWithoutQueryingOrders()
    {
        var (controller, orders, _) = CreateController();

        var result = await controller.Track("NP260101ABCD", "017123", CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result.Result);
        orders.Verify(repo => repo.FindAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task PublicTrackingPassesOnlyTheExactFullPhoneToTheRepository()
    {
        var (controller, orders, _) = CreateController();
        orders.Setup(repo => repo.FindAsync("NP260101ABCD", "01712345678", It.IsAny<CancellationToken>()))
            .ReturnsAsync((Order?)null);

        var result = await controller.Track("NP260101ABCD", "01712345678", CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result.Result);
        orders.Verify(repo => repo.FindAsync(
            "NP260101ABCD",
            "01712345678",
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task WishlistReadsOnlyTheAuthenticatedUsersItems()
    {
        var wishlist = new Mock<IWishlistRepository>();
        wishlist.Setup(repo => repo.GetForUserAsync("user-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync([new WishlistItem { UserId = "user-1", ProductId = "product-1" }]);
        var products = new Mock<IProductRepository>();
        products.Setup(repo => repo.GetByIdsAsync(
                It.Is<IEnumerable<string>>(ids => ids.Single() == "product-1"),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync([new Product { Id = "product-1", Name = "Controller" }]);
        var controller = new WishlistController(wishlist.Object, products.Object)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new System.Security.Claims.ClaimsPrincipal(
                        new System.Security.Claims.ClaimsIdentity(
                            [new System.Security.Claims.Claim("sub", "user-1")],
                            "test")),
                },
            },
        };

        var result = await controller.List(CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        wishlist.Verify(repo => repo.GetForUserAsync("user-1", It.IsAny<CancellationToken>()), Times.Once);
        wishlist.Verify(repo => repo.GetForUserAsync("user-2", It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task AdminCannotMoveDeliveredOrderBackToPending()
    {
        var orders = new Mock<IOrderRepository>();
        orders.Setup(repo => repo.GetAsync("order-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Order { Id = "order-1", Status = "delivered" });
        var controller = new AdminController(
            Mock.Of<IProductRepository>(),
            orders.Object,
            Mock.Of<IWebHostEnvironment>(),
            new OrderEventService(),
            new ConfigurationBuilder().Build(),
            Mock.Of<IHttpClientFactory>());

        var result = await controller.UpdateStatus(
            "order-1",
            new StatusUpdateRequest("pending", null),
            CancellationToken.None);

        Assert.IsType<ConflictObjectResult>(result.Result);
        orders.Verify(repo => repo.UpdateAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ConfirmingAwaitingBkashOrderMarksPaymentPaid()
    {
        var order = new Order
        {
            Id = "order-2",
            Status = "awaiting-verification",
            PaymentMethod = "bkash",
            BkashTrxId = "TRX-123",
        };
        var orders = new Mock<IOrderRepository>();
        orders.Setup(repo => repo.GetAsync("order-2", It.IsAny<CancellationToken>())).ReturnsAsync(order);
        orders.Setup(repo => repo.UpdateAsync(order, It.IsAny<CancellationToken>())).ReturnsAsync(true);
        var controller = new AdminController(
            Mock.Of<IProductRepository>(),
            orders.Object,
            Mock.Of<IWebHostEnvironment>(),
            new OrderEventService(),
            new ConfigurationBuilder().Build(),
            Mock.Of<IHttpClientFactory>());

        var result = await controller.UpdateStatus(
            "order-2",
            new StatusUpdateRequest("confirmed", "bKash payment verified"),
            CancellationToken.None);

        Assert.IsType<OkObjectResult>(result.Result);
        Assert.Equal("paid", order.PaymentStatus);
        Assert.Equal("confirmed", order.Status);
        orders.Verify(repo => repo.UpdateAsync(order, It.IsAny<CancellationToken>()), Times.Once);
    }

    private static (OrdersController Controller, Mock<IOrderRepository> Orders, Mock<ISmsService> Sms)
        CreateController()
    {
        var savedOrders = new Dictionary<string, Order>(StringComparer.Ordinal);
        var orders = new Mock<IOrderRepository>();
        orders
            .Setup(repo => repo.CreateOrGetAsync(It.IsAny<Order>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Order order, CancellationToken _) =>
            {
                if (savedOrders.TryGetValue(order.IdempotencyKey!, out var existing))
                    return (existing, false);
                savedOrders.Add(order.IdempotencyKey!, order);
                return (order, true);
            });

        var products = new Mock<IProductRepository>();
        products
            .Setup(repo => repo.GetAsync("product-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Product
            {
                Id = "product-1",
                Name = "Controller",
                Brand = "Example",
                Category = "controllers",
                Price = 1000,
                Stock = "in-stock",
            });

        var sms = new Mock<ISmsService>();
        sms.Setup(service => service.SendAsync(
                It.IsAny<string>(),
                It.IsAny<string>(),
                It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        var email = new Mock<IEmailService>();
        var controller = new OrdersController(
            orders.Object,
            products.Object,
            new OrderEventService(),
            email.Object,
            sms.Object,
            NullLogger<OrdersController>.Instance)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() },
        };
        return (controller, orders, sms);
    }

    private static PlaceOrderRequest CreateRequest() => new(
        new CustomerDto("Customer", "01712345678", null, "House 1", null, null, null),
        [new PlaceItemDto("product-1", 1, null)],
        "cod",
        null,
        null,
        1120);

    private static void SetIdempotencyKey(OrdersController controller, string key) =>
        controller.HttpContext.Request.Headers["Idempotency-Key"] = key;
}
