package com.company.Objects;

import com.company.Base;

import java.util.Scanner;

public class Closet extends Base {
    public String object = " Closet ";
    public static String name = "a closet";
    public static int position=-10;

    public static boolean newClothes = false;

    public static void openCloset() {
        System.out.println("you went and opened opened the closet");
        System.out.println("you can change your clothes hear OR do a little makeup OR view yourself in the mirror");
        System.out.println("type 'change' to change clothes.");
        System.out.println("type 'makeup' for a little makeup.");
        System.out.println("type 'view' to view yourself in the closet mirror");
        System.out.println("type 'close' to close the closet");
        Scanner scanner = new Scanner(System.in);
        label:
        while (true) {
            System.out.println("what would you like to do?");
            String action = scanner.nextLine();
            switch (action.toLowerCase()) {
                case "close":
                    break label;
                case "makeup":
                    makeup();
                    break;
                case "view":
                    view();
                    break;
                case "change":
                    changeClothes();
                    break;
                default:
                    System.out.println("please close the closet to do something else");
                    break;
            }
        }
        System.out.println("you closed the closet.you are now standing in the middle of the room.");
    }

    public static void changeClothes() {
        if (!newClothes) {
            System.out.println("you wear a new pair of clothes.");
            newClothes = true;
        }else {
            System.out.println("cannot change.you are already in a new pair of clothes.");
        }
    }

    public static void makeup() {
        System.out.println("you look at yourself in the closet mirror...");
        System.out.println("you realise that you already look fabulous.");
    }

    public static void view() {
        System.out.println("you look at yourself in the mirror of the closet...");
        System.out.println("you realise that you still look fabulous.");
    }

    @Override
    public void printMap(int position) {
        Closet.position = position;
        Base.positionCloset=position;
        setHere(object,position);
        super.printMap(position);
    }
}
