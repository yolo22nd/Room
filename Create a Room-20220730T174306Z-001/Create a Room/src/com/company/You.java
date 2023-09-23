package com.company;

public class You {
    public static int position = 13;

    public static int Lives = 10;
    public static boolean dead = false;
    public static boolean won = false;
    public static boolean haveShowKeys = true;
    public static boolean haveLamp = false;
    public static boolean haveHellKeys = false;
    public static boolean sitting = false;
    public static boolean sittingOnFloor=false;
    public static boolean slept = false;

    public static void sitOnFloor() {
        if (!sitting){
            sitting=true;
            sittingOnFloor=true;
            System.out.println("you sat on the floor.");
        }else {
            System.out.println("you are already sitting.");
        }
    }

    public static void pickUpShowKeys() {
        if (haveShowKeys) {
            System.out.println("you already have the key with you");
        }else {
            System.out.println("you picked up the key");
            haveShowKeys = true;
        }
    }

    public static void dropShowKeys() {
        if (haveShowKeys) {
            System.out.println("you dropped the key");
            haveShowKeys = false;
        }else {
            System.out.println("you don't have the key");
        }
    }

    public static void pickUpLamp() {
        if (haveLamp) {
            System.out.println("you already have lamp with you.");
        }else {
            System.out.println("you picked up the lamp");
            haveLamp = true;
        }
    }

    public static void dropLamp() {
        if (haveLamp) {
            System.out.println("you dropped the lamp");
            haveLamp = false;
        }else {
            System.out.println("you don't have the lamp with you");
        }
    }

    public static void pickUpHellKey() {
        if (haveHellKeys) {
            System.out.println("you already have the key with you");
        }else {
            System.out.println("you picked up the key");
            haveHellKeys = true;
        }
    }

    public static void dropHellKeys() {
        if (haveHellKeys) {
            System.out.println("you dropped the key");
            haveHellKeys = false;
        }else {
            System.out.println("you don't have the key");
        }
    }

    public static void stand() {
        if (sitting) {
            System.out.println("you stood up");
            sitting = false;
            sittingOnFloor = false;
        }else {
            System.out.println("you are already standing");
        }
    }







}
