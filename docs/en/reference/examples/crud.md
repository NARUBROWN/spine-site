# CRUD Example

A basic CRUD implementation example.

## Overview

A User CRUD example using an in-memory storage without an ORM. It is structured in Controller → Service → Repository layers.

```mermaid
graph TD
    Controller["Controller<br/>• Does not know HTTP<br/>• Receives input as semantic types<br/>• Calls Service"]
    
    Service["Service<br/>• Business Logic<br/>• Transaction Boundaries<br/>• Calls Repository"]
    
    Repository["Repository<br/>• Data Access<br/>• In-Memory / DB"]
    
    Controller --> Service
    Service --> Repository
```

## Project Structure

```
spine-user-demo/
├── main.go
├── model/
│   └── user.go
├── repository/
│   └── user_repository.go
├── service/
│   └── user_service.go
├── controller/
│   └── user_controller.go
└── dto/
    └── user_dto.go
```

## Model

```go
// model/user.go
package model

import "time"

type User struct {
    ID        int64     `json:"id"`
    Name      string    `json:"name"`
    Email     string    `json:"email"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}
```

## Repository

```go
// repository/user_repository.go
package repository

import (
    "errors"
    "sync"
    "time"

    "spine-user-demo/model"
)

var (
    ErrUserNotFound      = errors.New("user not found")
    ErrEmailAlreadyExists = errors.New("email already exists")
)

type UserRepository struct {
    mu      sync.RWMutex
    users   map[int64]*model.User
    counter int64
}

func NewUserRepository() *UserRepository {
    return &UserRepository{
        users:   make(map[int64]*model.User),
        counter: 0,
    }
}

func (r *UserRepository) FindAll() []*model.User {
    r.mu.RLock()
    defer r.mu.RUnlock()

    result := make([]*model.User, 0, len(r.users))
    for _, user := range r.users {
        result = append(result, user)
    }
    return result
}

func (r *UserRepository) FindByID(id int64) (*model.User, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()

    user, ok := r.users[id]
    if !ok {
        return nil, ErrUserNotFound
    }
    return user, nil
}

func (r *UserRepository) FindByEmail(email string) (*model.User, error) {
    r.mu.RLock()
    defer r.mu.RUnlock()

    for _, user := range r.users {
        if user.Email == email {
            return user, nil
        }
    }
    return nil, ErrUserNotFound
}

func (r *UserRepository) ExistsByEmail(email string) bool {
    _, err := r.FindByEmail(email)
    return err == nil
}

func (r *UserRepository) Save(user *model.User) *model.User {
    r.mu.Lock()
    defer r.mu.Unlock()

    now := time.Now()

    if user.ID == 0 {
        r.counter++
        user.ID = r.counter
        user.CreatedAt = now
    }
    user.UpdatedAt = now

    r.users[user.ID] = user
    return user
}

func (r *UserRepository) Delete(id int64) error {
    r.mu.Lock()
    defer r.mu.Unlock()

    if _, ok := r.users[id]; !ok {
        return ErrUserNotFound
    }

    delete(r.users, id)
    return nil
}

func (r *UserRepository) Count() int {
    r.mu.RLock()
    defer r.mu.RUnlock()
    return len(r.users)
}
```

## DTO

```go
// dto/user_dto.go
package dto

import (
    "time"

    "spine-user-demo/model"
)

// Request DTO

type CreateUserRequest struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}

type UpdateUserRequest struct {
    Name  string `json:"name"`
    Email string `json:"email"`
}

// Response DTO

type UserResponse struct {
    ID        int64     `json:"id"`
    Name      string    `json:"name"`
    Email     string    `json:"email"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

type UserListResponse struct {
    Users []UserResponse `json:"users"`
    Total int            `json:"total"`
}

// Conversion Functions

func ToUserResponse(user *model.User) UserResponse {
    return UserResponse{
        ID:        user.ID,
        Name:      user.Name,
        Email:     user.Email,
        CreatedAt: user.CreatedAt,
        UpdatedAt: user.UpdatedAt,
    }
}

func ToUserListResponse(users []*model.User) UserListResponse {
    responses := make([]UserResponse, len(users))
    for i, user := range users {
        responses[i] = ToUserResponse(user)
    }
    return UserListResponse{
        Users: responses,
        Total: len(responses),
    }
}
```

## Service

```go
// service/user_service.go
package service

import (
    "spine-user-demo/dto"
    "spine-user-demo/model"
    "spine-user-demo/repository"
)

type UserService struct {
    repo *repository.UserRepository
}

func NewUserService(repo *repository.UserRepository) *UserService {
    return &UserService{repo: repo}
}

func (s *UserService) GetAllUsers() dto.UserListResponse {
    users := s.repo.FindAll()
    return dto.ToUserListResponse(users)
}

func (s *UserService) GetUserByID(id int64) (*dto.UserResponse, error) {
    user, err := s.repo.FindByID(id)
    if err != nil {
        return nil, err
    }

    response := dto.ToUserResponse(user)
    return &response, nil
}

func (s *UserService) CreateUser(req *dto.CreateUserRequest) (*dto.UserResponse, error) {
    // Check Email Duplicate
    if s.repo.ExistsByEmail(req.Email) {
        return nil, repository.ErrEmailAlreadyExists
    }

    user := &model.User{
        Name:  req.Name,
        Email: req.Email,
    }

    saved := s.repo.Save(user)
    response := dto.ToUserResponse(saved)
    return &response, nil
}

func (s *UserService) UpdateUser(id int64, req *dto.UpdateUserRequest) (*dto.UserResponse, error) {
    user, err := s.repo.FindByID(id)
    if err != nil {
        return nil, err
    }

    // Check Email Duplicate on Change
    if req.Email != user.Email && s.repo.ExistsByEmail(req.Email) {
        return nil, repository.ErrEmailAlreadyExists
    }

    user.Name = req.Name
    user.Email = req.Email

    saved := s.repo.Save(user)
    response := dto.ToUserResponse(saved)
    return &response, nil
}

func (s *UserService) DeleteUser(id int64) error {
    return s.repo.Delete(id)
}
```

## Controller

```go
// controller/user_controller.go
package controller

import (
    "errors"

    "github.com/NARUBROWN/spine/pkg/httperr"
    "github.com/NARUBROWN/spine/pkg/path"

    "spine-user-demo/dto"
    "spine-user-demo/repository"
    "spine-user-demo/service"
)

type UserController struct {
    service *service.UserService
}

func NewUserController(service *service.UserService) *UserController {
    return &UserController{service: service}
}

// GET /users
func (c *UserController) List() dto.UserListResponse {
    return c.service.GetAllUsers()
}

// GET /users/:id
func (c *UserController) GetByID(id path.Int) (dto.UserResponse, error) {
    if id.Value <= 0 {
        return dto.UserResponse{}, httperr.BadRequest("Invalid user ID")
    }

    user, err := c.service.GetUserByID(id.Value)
    if err != nil {
        return dto.UserResponse{}, toHTTPError(err)
    }

    return *user, nil
}

// POST /users
func (c *UserController) Create(req *dto.CreateUserRequest) (dto.UserResponse, error) {
    if req.Name == "" {
        return dto.UserResponse{}, httperr.BadRequest("Name is required")
    }
    if req.Email == "" {
        return dto.UserResponse{}, httperr.BadRequest("Email is required")
    }

    user, err := c.service.CreateUser(req)
    if err != nil {
        return dto.UserResponse{}, toHTTPError(err)
    }

    return *user, nil
}

// PUT /users/:id
func (c *UserController) Update(id path.Int, req *dto.UpdateUserRequest) (dto.UserResponse, error) {
    if id.Value <= 0 {
        return dto.UserResponse{}, httperr.BadRequest("Invalid user ID")
    }
    if req.Name == "" {
        return dto.UserResponse{}, httperr.BadRequest("Name is required")
    }
    if req.Email == "" {
        return dto.UserResponse{}, httperr.BadRequest("Email is required")
    }

    user, err := c.service.UpdateUser(id.Value, req)
    if err != nil {
        return dto.UserResponse{}, toHTTPError(err)
    }

    return *user, nil
}

// DELETE /users/:id
func (c *UserController) Delete(id path.Int) error {
    if id.Value <= 0 {
        return httperr.BadRequest("Invalid user ID")
    }

    err := c.service.DeleteUser(id.Value)
    if err != nil {
        return toHTTPError(err)
    }

    return nil
}

// Convert Repository Error to HTTP Error
func toHTTPError(err error) error {
    switch {
    case errors.Is(err, repository.ErrUserNotFound):
        return httperr.NotFound("User not found")
    case errors.Is(err, repository.ErrEmailAlreadyExists):
        return httperr.BadRequest("Email already in use")
    default:
        return httperr.BadRequest(err.Error())
    }
}
```

## Main

```go
// main.go
package main

import (
    "log"

    "github.com/NARUBROWN/spine"
    "github.com/NARUBROWN/spine/interceptor/cors"
    "github.com/NARUBROWN/spine/pkg/boot"

    "spine-user-demo/controller"
    "spine-user-demo/repository"
    "spine-user-demo/service"
)

func main() {
    app := spine.New()

    // Constructor Registration 
    app.Constructor(
        repository.NewUserRepository,
        service.NewUserService,
        controller.NewUserController,
    )

    // Route Registration
    app.Route("GET", "/users", (*controller.UserController).List)
    app.Route("GET", "/users/:id", (*controller.UserController).GetByID)
    app.Route("POST", "/users", (*controller.UserController).Create)
    app.Route("PUT", "/users/:id", (*controller.UserController).Update)
    app.Route("DELETE", "/users/:id", (*controller.UserController).Delete)

    // Interceptor Registration
    app.Interceptor(
        cors.New(cors.Config{
            AllowOrigins: []string{"*"},
            AllowMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
            AllowHeaders: []string{"Content-Type"},
        }),
    )

    // Start Server
    app.Run(boot.Options{
		Address:                ":8080",
		EnableGracefulShutdown: true,
		ShutdownTimeout:        10 * time.Second,
		HTTP: &boot.HTTPOptions{},
	});
}
```

## API Test

### Create User

```bash
curl -X POST http://localhost:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'
```

```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com",
  "created_at": "2025-01-19T10:00:00Z",
  "updated_at": "2025-01-19T10:00:00Z"
}
```

### Get User List

```bash
curl http://localhost:8080/users
```

```json
{
  "users": [
    {
      "id": 1,
      "name": "Alice",
      "email": "alice@example.com",
      "created_at": "2025-01-19T10:00:00Z",
      "updated_at": "2025-01-19T10:00:00Z"
    }
  ],
  "total": 1
}
```

### Get User

```bash
curl http://localhost:8080/users/1
```

```json
{
  "id": 1,
  "name": "Alice",
  "email": "alice@example.com",
  "created_at": "2025-01-19T10:00:00Z",
  "updated_at": "2025-01-19T10:00:00Z"
}
```

### Update User

```bash
curl -X PUT http://localhost:8080/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice(Updated)", "email": "alice.new@example.com"}'
```

```json
{
  "id": 1,
  "name": "Alice(Updated)",
  "email": "alice.new@example.com",
  "created_at": "2025-01-19T10:00:00Z",
  "updated_at": "2025-01-19T10:05:00Z"
}
```

### Delete User

```bash
curl -X DELETE http://localhost:8080/users/1
```

### Error Response

```bash
# User Not Found
curl http://localhost:8080/users/999
```

```json
{
  "message": "User not found"
}
```

```bash
# Duplicate Email
curl -X POST http://localhost:8080/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Bob", "email": "alice@example.com"}'
```

```json
{
  "message": "Email already in use"
}
```

## Key Points

### Controller does not know Http

```go
// ✓ Receives input as semantic type
func (c *UserController) GetByID(id path.Int) (dto.UserResponse, error)

// ✓ Expresses meaning with httperr
return dto.UserResponse{}, httperr.NotFound("User not found")
```

### Dependency Injection

```go
// Auto-resolves dependencies just by registering constructors
app.Constructor(
    repository.NewUserRepository,  // No Dependencies
    service.NewUserService,        // Depends on Repository
    controller.NewUserController,  // Depends on Service
)
```

### Layer Separation

| Layer | Responsibility | Depends On |
|-------|------|------|
| Controller | Input Validation, Error Conversion | Service |
| Service | Business Logic | Repository |
| Repository | Data Access | None |
