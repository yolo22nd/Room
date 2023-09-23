package com.company.RoomsNDoors;

import com.company.Actions;
import com.company.Base;
import com.company.Objects.Closet;
import com.company.You;

import java.util.Scanner;

public class Bathroom extends Base {
    public String object = "Bathroom";
    public static String name = "a Bathroom";
    public static int position=-10;
    public static int sectorPosition;
    public static int doorPosition;

    public static boolean showerTaken = false;
    public static boolean tapOff = true;
    public static boolean peed = false;

    public void setPosition(int sectorPosition) {
        Bathroom.sectorPosition = sectorPosition;
        switch (sectorPosition) {
            case 8:
                doorPosition=31;
                position = 3;
                break;
            case 12:
                doorPosition=32;
                position = 11;
                break;
            case 14:
                doorPosition=33;
                position = 15;
                break;
            case 18:
                doorPosition=34;
                position = 23;
                break;
            default:
                position = -1;
        }
    }

    public static void useBathroom() {
        System.out.println("you have entered the bathroom");
        System.out.println("in here you can turn the tap ON and OFF,take a bath,pee,and wash your face");
        Scanner scanner = new Scanner(System.in);
        System.out.println("type 'turn' to turn tap on and off");
        System.out.println("type 'go' to go to showering area OR back in the room");
        System.out.println("type 'wash' to wash your face");
        System.out.println("type 'pee' to pee");
        System.out.println("type 'locate' to find where you are");
        label:
        while (true) {
            String action = scanner.nextLine().toLowerCase();
            switch (action) {
                case "turn":
                    turnTap();
                    break;
                case "go" :
                    System.out.println("where do you want to go to?");
                    System.out.println("room OR shower(showering area)");
                    String answer = scanner.nextLine().toLowerCase();
                    if (answer.equals("room")) {
                        if (tapOff) {
                            break label;
                        }else {
                            System.out.println("you have to turn the tap off before leaving the bathroom");
                        }
                    }else if (answer.equals("shower")) {
                        goToShower();
                    }else {
                        System.out.println("input not recognised");
                    }
                    break;
                case "wash":
                    washFace();
                    break ;
                case "pee":
                    pee();
                    break;
                case "locate":
                    Actions.locate();
                    break;
                default:
                    System.out.println("input not recognised");
            }
        }
        System.out.println("you left the bathroom.now you are in the room");
        You.position=sectorPosition;
        Base.setYou();
    }

    public static void goToShower() {
        System.out.println("you go in the showering area");
        Scanner scanner=new Scanner(System.in);
        System.out.println("do you want to take a shower ?");
        System.out.println("yes OR no");
        String answer = scanner.nextLine().toLowerCase();
        if (answer.equals("yes")) {
            takeShower();
        }else  {
            System.out.println("then what would you like to do");
        }
    }

    public static void takeShower() {
        showerTaken = true;
        Closet.newClothes=true;
        System.out.println("you keep your lamp aside");
        System.out.println("you strip take off you soiled clothes.");
        System.out.println("you turn the tap and take a hot shower.");
        System.out.println("you wear a new pair of clothes.");
        System.out.println("you feel fresh and active.");
    }

    public static void turnTap() {
        if (tapOff){
            tapOff = false;
            System.out.println("you turned the tap");
            System.out.println("water is flowing");
        }else {
            tapOff = true;
            System.out.println("you turned the tap");
            System.out.println("water stopped flowing");
        }
    }

    public static void pee() {
        if (!peed) {
            peed = true;
            System.out.println("you peed");
        }else {
            System.out.println("you were not able to pee anymore");
        }
    }

    public static void washFace() {
        if (!tapOff) {
            System.out.println("you washed your face");
            System.out.println("please remember to turn off the tap");
        }else {
            System.out.println("please turn the tap to wash your face");
        }
    }

    @Override
    public void printMap(int sectorPosition) {
        setPosition(sectorPosition);
        Base.positionBathroom=position;
        setHere(object,position);
        super.printMap(position);
    }
}
