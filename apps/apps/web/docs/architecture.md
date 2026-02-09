# Architecture Decisions and code approach

## External Libraries

I've avoided using css external libraries for learning reasons.

## Architectural decisions

It's haves some of the concepts on the [clean architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)  however it's not a pure clean architecture, I wanted the ability to inject dependencies for make test easy and to be able to easily evolve the code, replace vendor libraries if I need it to do so, as some smart person once said, patterns are guidance only and we should not go crazy about it, trying to find places in our code to apply it, but instead it should flows naturally, changing as we need it.

## Understanding it

### File structure

***Divided by feature*** 
The idea it is to easily understand what it is, like when you look to a house sketch you know that the picture represents a house.

So this is a front-end app, you know that you will have a footer and header components, home page, a main entrance point and a feature like video.

Ideally that the file structure should speak for itself. 
